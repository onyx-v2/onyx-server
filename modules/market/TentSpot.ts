import {getPlayerTent, TradeTent} from "./TradeTent";
import {colshapeHandle, colshapes} from "../checkpoints";
import {ScaleformTextMp} from "../scaleform.mp";
import {menu} from "../menu";
import {systemUtil} from "../../../shared/system";
import {NpcSeller} from "./sellers/NpcSeller";
import {PlayerSeller} from "./sellers/PlayerSeller";
import {BlackViewStrategy} from "./viewStrategy/BlackViewStrategy";
import {CommonViewStrategy} from "./viewStrategy/CommonViewStrategy";
import {RentTimer} from "./RentTimer";
import {
    RENT_BLACK_TENT_COST,
    RENT_COMMON_TENT_COST,
    RENT_TICK_MINUTES, START_RENT_BLACK_TENT_COST,
    START_RENT_COMMON_TENT_COST
} from "../../../shared/market/config";

export class TentSpot {
    private tent: TradeTent = null;
    private rentColshape: colshapeHandle;
    private rentScaleform: ScaleformTextMp;

    public constructor(
        private readonly position: Vector3Mp,
        private readonly heading: number,
        private readonly isBlackMarket: boolean
    ) {
        this.createRentEntities();
    }

    private createRentEntities() {
        const colshapePosition = new mp.Vector3(this.position.x, this.position.y, this.position.z - 0.95);
        this.rentColshape = colshapes.new(colshapePosition, 'Ein Zelt mieten', this.rentTent.bind(this), {
            type: 27,
            color: this.isBlackMarket ? [0, 0, 0, 200] : [33, 150, 243, 200]
        });

        this.rentScaleform = new ScaleformTextMp(this.position, 'Ein Zelt mieten');
    }

    private destroyRentEntities() {
        this.rentScaleform.destroy();
        this.rentColshape.destroy();
    }

    private handleTentDestroy() {
        this.createRentEntities();
        this.tent = null;
    }

    private async rentTent(player: PlayerMp) {
        if (getPlayerTent(player)) {
            return player.notify('Du hast bereits ein gemietetes Zelt', 'error');
        }

        // TODO: Выбор времени аренды (до 5 часов)
        const rentTicksAmount = 30 / RENT_TICK_MINUTES;

        const rentCost = this.isBlackMarket
            ? rentTicksAmount * RENT_BLACK_TENT_COST + START_RENT_BLACK_TENT_COST
            : rentTicksAmount * RENT_COMMON_TENT_COST + START_RENT_COMMON_TENT_COST;

        const isSellerNpc = await menu.accept(player,
            'Willst du einen Verkäufer einstellen? Du wirst den Markt verlassen können, aber du wirst weniger Gewinn machen',
            'big', 30000, 'anheuern NPC', 'Verkaufe dich selbst'
        );

        const isPaymentSuccess = await player.user.tryPayment(rentCost, 'all',
            () => this.tent === null, 'Zeltmiete', 'Рынок');

        if (!isPaymentSuccess) {
            return;
        }

        this.destroyRentEntities();

        const seller = isSellerNpc
            ? new NpcSeller(this.position, this.heading)
            : new PlayerSeller(this.position, player);

        this.tent = new TradeTent(player, this.position, seller,
            this.isBlackMarket ? RENT_BLACK_TENT_COST : RENT_COMMON_TENT_COST,
            new RentTimer(rentTicksAmount * RENT_TICK_MINUTES * 60),
            this.handleTentDestroy.bind(this),
        );

        this.tent.viewStrategy = this.isBlackMarket
            ? new BlackViewStrategy(this.tent)
            : new CommonViewStrategy(this.tent);

        player.notify('Du hast erfolgreich ein Zelt gemietet und kannst mit dem Handel beginnen', 'success');
    }
}