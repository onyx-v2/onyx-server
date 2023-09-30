import {CustomEvent} from "../../custom.event";
import {getPlayerTent} from "../TradeTent";
import {getMarketRentCompensation, RENT_COMMON_TENT_COST, RENT_TICK_MINUTES} from "../../../../shared/market/config";
import {menu} from "../../menu";
import {systemUtil} from "../../../../shared/system";

CustomEvent.registerCef('market::finishRent', async (player) => {
    player.user.setGui(null);
    const tent = getPlayerTent(player);
    if (!tent) {
        return;
    }

    const compensation = getMarketRentCompensation(tent.timeLeftS);
    const playerAnswer = await menu.accept(player,
        `Bist du sicher, dass du deinen Mietvertrag vorzeitig beenden und eine ${systemUtil.numberFormat(compensation)}`);

    if (!playerAnswer || !tent.exists) {
        return;
    }

    tent.destroy();
    player.user.addMoney(compensation, true, 'Rückerstattung bei vorzeitiger Beendigung der Zeltmiete');
    player.notify('Du hast deine Zeltmiete vorzeitig beendet, nicht verkaufte Artikel werden ins Lager gebracht', 'success');
});

CustomEvent.registerCef('market::expandRent', async (player, expandTimeMin: number) => {
    player.user.setGui(null);
    const tent = getPlayerTent(player);
    if (!tent) {
        return;
    }

    const expandRentCost = expandTimeMin / RENT_TICK_MINUTES * RENT_COMMON_TENT_COST;
    const isPaymentSuccess = await player.user.tryPayment(expandRentCost, 'all',
        () => tent.exists, 'Verlängerung der Zeltmiete', 'Markt');

    if (!isPaymentSuccess) {
        return;
    }

    tent.expandRentTime(expandTimeMin * 60);
    player.notify(`Du hast die Mietzeit erhöht um ${expandTimeMin} min.`, 'success');
});
