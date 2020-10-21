import { ServerInformation, serverInformationEndpoint, TransportEvents } from 'shared';
import io from 'socket.io-client';
import { Configuration } from './config/configuration';

export type PlayerDecision = {
  playerName: string;
  server: string;
};

const pollInterval = 10000;
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
    this.divElement.appendChild(this.inputElement);
    this.divElement.appendChild(this.labelElement);
    this.setPlayerLabelText();

    this.socket = io(url, {
      reconnection: false,
      timeout: 1500,
    });

    this.socket.on('connect_error', this.destroy.bind(this));
    this.socket.on('connect_timeout', this.destroy.bind(this));
    this.socket.on('disconnect', this.destroy.bind(this));
    this.socket.emit(TransportEvents.SubscribeForPlayerCount);
    this.socket.on(TransportEvents.PlayerCountUpdate, (v: number) => {
      this.content.playerCount = v;
      this.setPlayerLabelText();
    });
  }

  public destroy() {
    this.socket.close();
    this.divElement.parentElement?.removeChild(this.divElement);
    this.onDestroy(this);
  }

  private setPlayerLabelText() {
    this.labelElement.innerText = `${this.content.serverName} - ${this.content.playerCount}/${this.content.playerLimit} players`;
  }

  public get element(): HTMLElement {
    return this.divElement;
  }
}
