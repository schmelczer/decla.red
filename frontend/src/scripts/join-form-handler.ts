import { ServerInformation, serverInformationEndpoint, TransportEvents } from 'shared';
import { io, Socket } from 'socket.io-client';
import { servers } from './configuration';
import parser from 'socket.io-msgpack-parser';
import { SoundHandler, Sounds } from './sound-handler';

export type PlayerDecision = {
  name: string;
  server: string;
};

const pollInterval = 8000;

export class JoinFormHandler {
  private readonly joinButton: HTMLButtonElement;
  private readonly decision: Promise<PlayerDecision>;
  private readonly pollServersTimer: ReturnType<typeof setInterval>;
  private servers: Array<ServerChooserOption> = [];

  private keyUpListener = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !this.joinButton.disabled) {
      this.form.requestSubmit();
    }
  };

  constructor(
    private readonly form: HTMLFormElement,
    private readonly container: HTMLElement,
  ) {
    this.joinButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    this.joinButton.disabled = true;

    this.decision = new Promise((resolve) => {
      form.onsubmit = (e) => {
        e.preventDefault();
        SoundHandler.play(Sounds.click);
        const data = new FormData(form);
        resolve({ name: String(data.get('name')), server: String(data.get('server')) });
      };
    });
    this.decision.then(() => this.destroy());

    addEventListener('keyup', this.keyUpListener);
    this.pollServersTimer = setInterval(() => this.loadServers(), pollInterval);
    this.loadServers();
  }

  public getPlayerDecision(): Promise<PlayerDecision> {
    return this.decision;
  }

  private destroy() {
    removeEventListener('keyup', this.keyUpListener);
    clearInterval(this.pollServersTimer);
    this.servers.forEach((s) => s.destroy());
  }

  private loadServers() {
    servers
      .filter((url) => !this.servers.some((s) => s.url === url))
      .forEach(async (url) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), pollInterval * 0.8);

        let content: ServerInformation;
        try {
          const response = await fetch(url + serverInformationEndpoint, {
            signal: controller.signal,
          });
          if (!response.ok) {
            return;
          }
          content = await response.json();
        } catch {
          return;
        }

        if (!this.servers.some((s) => s.url === url)) {
          const server = new ServerChooserOption(
            content,
            url,
            (s) => this.removeServer(s),
            this.servers.length === 0,
          );
          this.servers.push(server);
          this.joinButton.disabled = false;
          this.container.appendChild(server.element);
        }
      });
  }

  private removeServer(server: ServerChooserOption) {
    this.servers = this.servers.filter((s) => s !== server);
    this.joinButton.disabled = this.servers.length === 0;
  }
}

const roundCompletionTexts = [
  'Just started',
  'Just started',
  'Ongoing',
  'Halfway through',
  'Nearly over',
  'About to finish',
  'Game is over',
];

class ServerChooserOption {
  public readonly element = document.createElement('div');
  private readonly serverNameElement = document.createElement('span');
  private readonly completionElement = document.createElement('span');
  private readonly socket: Socket;

  constructor(
    private readonly content: ServerInformation,
    public readonly url: string,
    private readonly onDestroy: (v: ServerChooserOption) => unknown,
    isFirst: boolean,
  ) {
    const input = document.createElement('input');
    input.required = true;
    input.type = 'radio';
    input.id = input.value = url;
    input.name = 'server';
    input.checked = isFirst;

    const label = document.createElement('label');
    label.htmlFor = url;
    label.onclick = () => SoundHandler.play(Sounds.click);
    label.append(
      this.serverNameElement,
      document.createElement('br'),
      this.completionElement,
    );
    this.completionElement.className = 'completion';

    this.element.append(input, label);
    this.setServerInfoLabelText();

    this.socket = io(url, {
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 4000,
      parser,
    } as any);

    this.socket.io.on('reconnect_failed', () => this.destroy());
    this.socket.on('connect', () =>
      this.socket.emit(TransportEvents.SubscribeForServerInfoUpdates),
    );
    this.socket.on(
      TransportEvents.ServerInfoUpdate,
      ([playerCount, gameState]: [number, number]) => {
        this.content.playerCount = playerCount;
        this.content.gameStatePercent = gameState;
        this.setServerInfoLabelText();
      },
    );
  }

  public destroy() {
    this.socket.close();
    this.element.remove();
    this.onDestroy(this);
  }

  private setServerInfoLabelText() {
    const { serverName, playerCount, playerLimit, gameStatePercent } = this.content;
    this.serverNameElement.innerText = `${serverName} - ${playerCount}/${playerLimit} players`;
    this.completionElement.innerText =
      roundCompletionTexts[
        Math.floor((gameStatePercent / 100) * (roundCompletionTexts.length - 1))
      ];
  }
}
