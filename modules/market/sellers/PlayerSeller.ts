import {ISeller} from "./ISeller";
import {CustomEvent} from "../../custom.event";

export class PlayerSeller implements ISeller {
    public constructor(
        private readonly position: Vector3Mp,
        private readonly player: PlayerMp
    ) {
        player.notify('Da du die Waren selbst verkaufst, kannst du den Marktplatz nicht verlassen', 'info');

        CustomEvent.triggerClient(player, 'market:setSellerPosition', this.position);
    }

    public destroy(isTentDestroyed: boolean): void {
        CustomEvent.triggerClient(this.player, 'market:setSellerPosition', null);
    }

    public makePayment(money: number): void {
        return;
    }

    public getSellsPercent(): number {
        return 0;
    }

    public callToTent(caller: PlayerMp): void {
        CustomEvent.triggerClient(this.player, 'market:calledByCop');
        caller.notify('Der Besitzer des Zeltes wird sich in nächster Zeit bei ihr melden');
    }
}