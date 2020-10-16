import { ServerInformation, serverInformationEndpoint } from 'shared';

import { Configuration } from './config/configuration';

export type PlayerDecision = {
  playerName: string;
  server: string;
};

export class JoinFormHandler {
  private waitingForDecision: Promise<PlayerDecision>;
  private resolvePlayerDecision!: (d: PlayerDecision) => void;

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

    this.loadServers();
  }

  private async loadServers() {
    await Configuration.initialize();
    const serverList = Configuration.servers;

    serverList.map(async (url) => {
      const response = await fetch(url + serverInformationEndpoint);
      if (response.ok) {
        const content: ServerInformation = await response.json();
        this.displayNewServerInfo(content, url);
      }
    });
  }

  public async getPlayerDecision(): Promise<PlayerDecision> {
    return this.waitingForDecision;
  }

  private isFirstServer = true;
  private displayNewServerInfo(content: ServerInformation, url: string) {
    this.container.innerHTML += `
    <div>
      <input required ${
        this.isFirstServer ? 'checked' : ''
      } type="radio" id="${url}" name="server" value="${url}" />
      <label for="${url}">${content.serverName} - ${content.playerCount}/${
      content.playerLimit
    } players</label>
    </div>
    `;
    this.isFirstServer = false;
  }
}
