import {gui} from "../../gui";
import {
    ADMIN_LEVEL_EVENT_ACCESS, COMMAND_EVENT_CHAT_COLOR,
    COMMAND_EVENT_DIMENSION,
    ICommandEventState
} from "../../../../shared/adminEvents/commandEvent/config";
import {menu, MenuClass} from "../../menu";

class CommandEvent {

    private _state: ICommandEventState = null;
    private _data: ICommandEventState = CommandEvent.getEmptyState();

    constructor() {
        gui.chat.registerCommand('aevent', this.adminCommandHandler);
        gui.chat.registerCommand('event', this.playerCommandHandler);
        mp.events.add('playerDeath', this.deathHandler);
    }

    private adminCommandHandler = (player: PlayerMp): void => {
        if (!player.user) return;
        if (!player.user.isAdminNow(ADMIN_LEVEL_EVENT_ACCESS)) return;

        this.openAdminMenu(player);
    }

    private playerCommandHandler = (player: PlayerMp): void => {
        if (!player.user) return;
        if (this._state === null)
            return player.notify('Zurzeit finden keine Aktivitäten statt', 'error');

        if (!this._state.teleportActive)
            return player.notify('Teleport zum Ereignis ist geschlossen', 'error');

        if (this._state.players.length >= this._state.maxPlayers)
            return player.notify('Maximale Anzahl von Teilnehmern pro Veranstaltung', 'error');

        if (
            this._state.players.find(el => el === player.user.id) !== undefined
            &&
            player.dimension === COMMAND_EVENT_DIMENSION
        )
            return player.notify('Du bist bereits bei der Veranstaltung', 'error');

        if (this._state.players.find(el => el === player.user.id) === undefined)
            this._state.players.push(player.user.id);

        const randomX = Math.floor(Math.random() * 10 - 5),
            randomY = Math.floor(Math.random() * 10 - 5);

        player.user.teleport(
            this._state.spawnPosition.x + randomX,
            this._state.spawnPosition.y + randomY,
            this._state.spawnPosition.z + 0.5,
            180,
            COMMAND_EVENT_DIMENSION
        );

        player.notify('Du wurdest zu dem Ereignis teleportiert, folge den Anweisungen des Administrators', 'success');
    }

    private static getEmptyState(): ICommandEventState {
        return {
            name: '',
            spawnPosition: new mp.Vector3(0, 0, 0),
            returnPosition: new mp.Vector3(0, 0, 0),
            maxPlayers: 50
        }
    }

    private openAdminMenu(player: PlayerMp): void {
        const _menu = new MenuClass(player, 'Team-Event');

        if (this._state === null) {
            _menu.newItem({
                name: 'Titel',
                more: this._data.name !== '' ? this._data.name : '~r~Es ist notwendig, Folgendes anzugeben',
                onpress: async () => {
                    const name = await menu.input(player, 'Titel', this._data.name, 150, 'text');
                    if (name) this._data.name = name;

                    this.openAdminMenu(player);
                }
            });

            _menu.newItem({
                type: 'range',
                name: 'Maximale Anzahl von Spielern pro Veranstaltung',
                more: this._data.maxPlayers,
                rangeselect: [1, 1500],
                onchange: (value) => {
                    this._data.maxPlayers = value;
                }
            });

            _menu.newItem({
                name: "Punkt des Auftritts bei der Veranstaltung",
                more: this._data.spawnPosition.x !== 0 ? "~g~Angegeben" : "~r~Du musst angeben",
                onpress: () => {
                    if (this._data.spawnPosition.x !== 0) {
                        this._data.spawnPosition = new mp.Vector3(0, 0, 0)
                    } else {
                        this._data.spawnPosition = player.position;
                    }

                    this.openAdminMenu(player);
                }
            })

            _menu.newItem({
                name: "Ort des Erscheinens nach der Veranstaltung",
                more: this._data.returnPosition.x !== 0 ? "~g~Angegeben" : "~r~Du musst angeben",
                onpress: () => {
                    if (this._data.returnPosition.x !== 0) {
                        this._data.returnPosition = new mp.Vector3(0, 0, 0)
                    } else {
                        this._data.returnPosition = player.position;
                    }

                    this.openAdminMenu(player);
                }
            })

            _menu.newItem({
                name: "~g~Anlassen",
                onpress: async () => {
                    if (this._data.name === '')
                        return player.notify('Der Name der Veranstaltung sollte angegeben werden', 'error');

                    if (this._data.spawnPosition.x === 0)
                        return player.notify('Der Ort des Auftritts bei der Veranstaltung muss angegeben werden', 'error');

                    if (this._data.returnPosition.x === 0)
                        return player.notify('Der Ort des Erscheinens nach dem Ereignis sollte angegeben werden', 'error');

                    const state = {...this._data};
                    state.teleportActive = true;
                    state.players = [];
                    state.adminName = player.user.name;
                    this._data = CommandEvent.getEmptyState();

                    const validPlayers = mp.players.toArray().filter(p => !!p.user);

                    validPlayers.forEach(p => {
                        p.outputChatBox(
                            `!{${COMMAND_EVENT_CHAT_COLOR}}Administrator ${state.adminName}` +
                            ` startete die Veranstaltung ${state.name},` +
                            `um teilzunehmen, nutze den Befehl - /event`
                        );
                    })

                    this._state = state
                    _menu.close();
                    player.notify('Die Veranstaltung wurde erfolgreich gestartet', 'success');
                }
            });

            _menu.newItem({
                name: "~y~Clear",
                onpress: async () => {
                    this._data = CommandEvent.getEmptyState();
                    this.openAdminMenu(player);
                }
            });
        } else {
            _menu.newItem({
                name: `${this._state.name} erstellt ${this._state.adminName}`
            });

            _menu.newItem({
                name: `Spieler in Dimensionen`,
                more: `${mp.players.toArray().filter(target => target.user && target.dimension === COMMAND_EVENT_DIMENSION).length}`
            });

            _menu.newItem({
                name: this._state.teleportActive ? "~r~Schließe den Teleporter" : "~g~Öffne den Teleporter",
                onpress: async () => {
                    this._state.teleportActive = !this._state.teleportActive;
                    this.openAdminMenu(player);

                    const validPlayers = mp.players.toArray().filter(p => !!p.user);

                    validPlayers.forEach(p => {
                        if (this._state.teleportActive) {
                            p.outputChatBox(
                                `!{${COMMAND_EVENT_CHAT_COLOR}} Ereignis: Teleport ist offen für Teleport.` +
                                ` Gib das Kommando ein - /event`
                            );
                        } else {
                            p.outputChatBox(
                                `!{${COMMAND_EVENT_CHAT_COLOR}} Ereignis: Teleport geschlossen.`
                            );
                        }
                    })
                }
            });

            _menu.newItem({
                name: "~r~Закончить мероприятие",
                onpress: async () => {
                    const pos = new mp.Vector3(
                        this._state.returnPosition.x,
                        this._state.returnPosition.y,
                        this._state.returnPosition.z
                    );

                    this._state = null;

                    const players = mp.players.toArray().filter(target => player.user &&
                        target.dimension === COMMAND_EVENT_DIMENSION)

                    players.forEach(target => {
                        const randomX = Math.floor(Math.random() * 10 - 5),
                            randomY = Math.floor(Math.random() * 10 - 5);

                        target.user.spawn(new mp.Vector3(pos.x + randomX, pos.y + randomY, pos.z + 0.5));
                        target.dimension = 0;
                    });


                    player.notify('Das Ereignis wurde erfolgreich abgeschlossen', 'success');
                    _menu.close();
                }
            });
        }

        _menu.open();
    }

    private deathHandler = (player: PlayerMp) => {
        if (this._state === null) return;
        if (!player.user || player.dimension !== COMMAND_EVENT_DIMENSION) return;
        //if (this._state.players.find(id => player.user.id === id) === undefined)

        player.user.spawn(this._state.returnPosition);
        player.dimension = 0;

    }
}

export const commandEvent = new CommandEvent();

// Написано под хард рок / металлику