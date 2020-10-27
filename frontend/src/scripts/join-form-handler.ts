import { ServerInformation, serverInformationEndpoint, TransportEvents } from 'shared';
import io from 'socket.io-client';
import { Configuration } from './config/configuration';
import parser from 'socket.io-msgpack-parser';
import { SoundHandler, Sounds } from './sound-handler';

export type PlayerDecision = {
  playerName: string;
  server: string;
};

const pollInterval = 8000;
export class JoinFormHandler {
  private waitingForDecision: Promise<PlayerDecision>;
  private resolvePlayerDecision!: (d: PlayerDecision) => void;
  private pollServersTimer: any;

  constructor(form: HTMLFormElement, private readonly container: HTMLElement) {
    this.waitingForDecision = new Promise((r) => (this.resolvePlayerDecision = r));

    new FormData(form);

    document.addEventListener('keyup', (e) => {
      if (e.key === 'enter') {
        form.submit();
      }
    });

    form.onsubmit = (e) => {
      SoundHandler.play(Sounds.click);
      const result: PlayerDecision = (Array.from(
        (new FormData(form) as any).entries(),
      ) as Array<[string, any]>).reduce((result, [name, value]) => {
        (result as any)[name] = value;
        return result;
      }, {}) as any;

      this.resolvePlayerDecision(result);

      e.preventDefault();
    };

    this.pollServersTimer = setInterval(this.loadServers.bind(this), pollInterval);
    this.loadServers();
    this.waitForFinish();
  }

  private async waitForFinish() {
    await this.waitingForDecision;
    this.destroy();
  }

  private destroy() {
    clearInterval(this.pollServersTimer);
    this.servers.forEach((s) => s.destroy());
  }

  private servers: Array<ServerChooserOption> = [];
  private async loadServers() {
    await Configuration.initialize();

    const serverList = Configuration.servers.filter(
      (u) => !this.servers.find((s) => s.url === u),
    );

    serverList.map(async (url) => {
      const controller = new AbortController();
      const signal = controller.signal;
      setTimeout(() => controller.abort(), pollInterval * 0.8);

      let response: Response | undefined;
      try {
        response = await fetch(url + serverInformationEndpoint, { signal });
      } catch {
        // it's okay
      }

      if (response?.ok) {
        const content: ServerInformation = await response.json();
        const server = new ServerChooserOption(
          content,
          url,
          (r) => (this.servers = this.servers.filter((s) => s !== r)),
          this.servers.length === 0,
        );
        this.servers.push(server);
        this.container.appendChild(server.element);
      }
    });
  }

  public async getPlayerDecision(): Promise<PlayerDecision> {
    return this.waitingForDecision;
  }
}

class ServerChooserOption {
  private divElement = document.createElement('div');
  private inputElement = document.createElement('input');
  private labelElement = document.createElement('label');
  private serverNameElement = document.createElement('span');
  private completionElement = document.createElement('span');

  private socket: SocketIOClient.Socket;

  constructor(
    private content: ServerInformation,
    public readonly url: string,
    private onDestroy: (v: ServerChooserOption) => unknown,
    isFirst: boolean,
  ) {
    this.inputElement.required = true;
    this.inputElement.type = 'radio';
    this.inputElement.id = this.inputElement.value = url;
    this.inputElement.name = 'server';
    this.inputElement.checked = isFirst;
    this.labelElement.htmlFor = url;
    this.labelElement.onclick = () => SoundHandler.play(Sounds.click);
    this.divElement.appendChild(this.inputElement);
    this.divElement.appendChild(this.labelElement);
    this.labelElement.appendChild(this.serverNameElement);
    this.labelElement.appendChild(document.createElement('br'));
    this.labelElement.appendChild(this.completionElement);
    this.completionElement.className = 'completion';
    this.setServerInfoLabelText();

    this.socket = io(url, {
      reconnection: false,
      timeout: 4000,
      parser,
    } as any);

    this.socket.on('connect_error', this.destroy.bind(this));
    this.socket.on('connect_timeout', this.destroy.bind(this));
    this.socket.on('disconnect', this.destroy.bind(this));
    this.socket.emit(TransportEvents.SubscribeForServerInfoUpdates);
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
    this.divElement.parentElement?.removeChild(this.divElement);
    this.onDestroy(this);
  }

  private getRoundCompletionText(percent: number): string {
    const texts = [
      'Just started',
      'Just started',
      'Ongoing',
      'Halfway through',
      'Nearly over',
      'About to finish',
      'Game is over',
    ];

    return texts[Math.floor((percent / 100) * (texts.length - 1))];
  }

  private setServerInfoLabelText() {
    this.serverNameElement.innerText = `${this.content.serverName} - ${this.content.playerCount}/${this.content.playerLimit} players`;
    this.completionElement.innerText = this.getRoundCompletionText(
      this.content.gameStatePercent,
    );
  }

  public get element(): HTMLElement {
    return this.divElement;
  }
}
