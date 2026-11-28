import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  Client,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js';

/** A slash command or a context menu, as Discord needs it to be registered. */
export type RegisteredCommand =
  | RESTPostAPIChatInputApplicationCommandsJSONBody
  | RESTPostAPIContextMenuApplicationCommandsJSONBody;

/**
 * The single seam between core and the panel feature.
 *
 * `core` must never import a feature module, and the panel both serves HTTP and knows which
 * built-in commands exist. So core owns the shape of the seam, the panel module registers an
 * implementation of it, and everything core needs — the request handler, the session check, the
 * disabled-command gate, the usage counter — goes through here instead of through an import.
 *
 * The implementation owns all of the state (routes, sessions, toggles, catalog). Nothing in this
 * file is stateful beyond the pointer.
 */
export interface PanelGateway {
  /** Answers `/api/panel/*`. Writes the response; returns false when the panel is off. */
  handle(
    client: Client,
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
    body: unknown,
  ): Promise<boolean>;
  /** Answers `/api/auth/*` (Better Auth owns those paths) and reports whether it did. */
  handleAuth(request: IncomingMessage, response: ServerResponse): Promise<boolean>;
  /** True when the panel's toggle list turns this command off. */
  isDisabled(command: string): boolean;
  /** Counts one command run for the panel's charts. Fire-and-forget by contract. */
  recordUsage(guildId: string, command: string, userId: string, source: 'builtin' | 'plugin'): void;
  /** What the bot publishes, so the panel can group and translate it. */
  describe(input: {
    catalog: RegisteredCommand[];
    builtIn: string[];
    owners: Record<string, string>;
  }): void;
}

let gateway: PanelGateway | undefined;

export function registerPanelGateway(next: PanelGateway): void {
  gateway = next;
}

/** Read-only access for the parts of core that must honour the panel's toggles. */
export const panelGateway = (): PanelGateway | undefined => gateway;
