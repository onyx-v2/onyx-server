import {ISirenPlace} from "../../../shared/siren/ISirenPlace";
import {MenuClass} from "../menu";
import {colshapeHandle, colshapes} from "../checkpoints";
import {CustomEvent} from "../custom.event";
import {Dispatch} from "../dispatch";
import {system} from "../system";
import {ISirenHistory} from "./ISirenHistory";

export class Siren {
    private config: ISirenPlace;
    private readonly shape: ColshapeMp;
    private readonly remote: colshapeHandle;
    private active: boolean = false;
    private lastStart: number = 0;
    private history: ISirenHistory[] = []

    constructor(sirenPlace: ISirenPlace) {
        this.config = sirenPlace;

        this.shape = mp.colshapes.newSphere(
            this.config.position.x,
            this.config.position.y,
            this.config.position.z,
            this.config.range,
            this.config.dimension
        );

        this.remote = colshapes.new(
            this.config.remote,
            "Alarmsirenen-Bedienfeld",
            (player: PlayerMp) => {
                if (!player.user || !this.config.fractionIds.includes(player.user.fraction))
                    return player.notify("Kein Zugang");
                this.openSirenMenu(player)
            }
        )

        mp.events.add("playerEnterColshape", this.playerEnter);
        mp.events.add("playerExitColshape", this.playerExit);
    }

    private startInterval = () => {
        const interval = setInterval(() => {
            if (this.active && system.timestamp - this.lastStart > this.config.time * 60) {
                this.disable();
                clearInterval(interval);
            }
        }, 5000);
    }

    public enable() {
        this.active = true;

        mp.players.forEachInRange(this.config.position, this.config.range + 500, (player) => {
            if (!this.shape.isPointWithin(player.position)) return;
            CustomEvent.triggerCef(
                player,
                'sound:play',
                'raid-siren',
                'raid-siren',
            );
        });
    }

    public disable() {
        this.active = false;

        mp.players.forEachInRange(this.config.position, this.config.range + 500, (player) => {
            if (!this.shape.isPointWithin(player.position)) return;
            CustomEvent.triggerCef(
                player,
                'sound:stop',
                'raid-siren'
            );
        });
    }


    private playerEnter = (player: PlayerMp, shape: ColshapeMp) => {
        if (!this.active) return;
        if (shape !== this.shape) return;

        CustomEvent.triggerCef(
            player,
            'sound:play',
            'raid-siren',
            'raid-siren',
        );
    }

    private playerExit = (player: PlayerMp, shape: ColshapeMp) => {
        if (!this.active) return;
        if (shape !== this.shape) return;
        CustomEvent.triggerCef(
            player,
            'sound:stop',
            'raid-siren'
        );
    }

    private openSirenMenu = (player: PlayerMp) => {
        const _menu = new MenuClass(player, 'Menü Alarm', this.config.name);


        _menu.newItem({
            name: this.active ? "~g~Ausschalten" : "~r~Aktiviere",
            desc: "Einschalten und Ausschalten der Alarmsirene",
            onpress: () => {
                if (!this.active && system.timestamp - this.lastStart < this.config.turnOnFrequency * 60)
                    return player.notify(`Schalten Sie nicht mehr als einmal pro ${this.config.turnOnFrequency} Minuten`, 'error');
                if (!this.active) {
                    this.lastStart = system.timestamp;
                    this.startInterval();
                    if (this.config.dispatchFractionIds) {
                        Dispatch.new(
                            this.config.dispatchFractionIds,
                            `Vor Ort ${this.config.name} die Sirene eingeschaltet wurde`,
                            {x: this.config.remote.x, y: this.config.remote.y}
                        );
                    }

                    this.history.unshift({
                        id: player.user.id,
                        name: player.user.name,
                        time: system.timestamp
                    })
                }

                player.notify(`Sirene ${this.active ? "aus" : "an"} erfolgreich`);
                this.active ? this.disable() : this.enable();
                _menu.close();
            }
        })

        _menu.newItem({
            name: "Geschichte der Inklusion",
            desc: "Dies zeigt den Verlauf der letzten Sirenenaktivierungen an",
            onpress: () => {
                const submenu = new MenuClass(player, 'Geschichte der Inklusion', this.config.name);

                this.history.forEach(el => {
                    submenu.newItem({
                        name: `${system.timeStampString(el.time)}`,
                        desc: `${el.name} [${el.id}]`
                    })
                })

                submenu.open();
            }
        })

        _menu.open();
    }
}
