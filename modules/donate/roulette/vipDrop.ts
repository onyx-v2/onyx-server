import {DropBase} from "./dropBase";
import {VipDropData} from "../../../../shared/donate/donate-roulette/Drops/vipDrop";
import {system} from "../../system";

export class VipDrop extends DropBase {
    constructor(public readonly data: VipDropData) {
        super(data.dropId);
    }

    protected onDropActivated(player: PlayerMp): boolean {
        if (player.user.vip && player.user.vip !== this.data.vipType && system.timestamp < player.user.vip_end) {
            player.notify(`Du hast bereits eine andere VIP-Ebene`, "error")
            return false;
        }
        player.user.giveVip(this.data.vipType, this.data.days);
        player.notify(`Du hast ${this.data.vipType} VIP für ${this.data.days} Tage!`)
        player.user.save();
        
        return true;
    };
}