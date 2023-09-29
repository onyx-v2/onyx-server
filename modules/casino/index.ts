import './roulette'
import './dice'
import './slots'
import './wheel'
import {CustomEvent} from "../custom.event";
import {CHIP_COST, CHIP_MIN_BUY, CHIP_MIN_SELL, CHIP_SELL_COST} from "../../../shared/casino/main";
import {CASINO_TELEPORT_NAME, TELEPORT_CONFIG} from "../../../shared/teleport.system";

CustomEvent.registerClientAndCef('casino:chips:buy', (player, count: number) => {
    const user = player.user;
    if(!user) return;
    if(!count || count < CHIP_MIN_BUY) return;
    const sum = CHIP_COST * count;
    if(user.money < sum) return player.notify('Du hast nicht genug Geld, um zu bezahlen', 'error');
    user.removeMoney(sum, true, 'Kauf von Chips');
    user.addChips(count, false, `Kauf von Chips`)
})

CustomEvent.registerClientAndCef('casino:chips:sell', (player, count: number) => {
    const user = player.user;
    if(!user) return;
    if(!count || count < CHIP_MIN_SELL) return;
    const sum = CHIP_SELL_COST * count;
    if(user.chips < count) return player.notify('Du hast nicht genug Chips zum Tauschen', 'error');
    user.addMoney(sum, true, 'Chips tauschen');
    user.removeChips(count, false, `Chips tauschen`)
})

CustomEvent.registerClient('casino:freeze', (player, status: {x: number, y: number, z: number}) => {
    player.setVariable('casino:freeze', status)
})

CustomEvent.registerClient('teleport:go', (player, confid: number, index: number) => {
    if (!player || !player.user) {
        return;
    }

    const teleportConfig = TELEPORT_CONFIG[confid];
    if (teleportConfig.name !== CASINO_TELEPORT_NAME) {
        return;
    }

    if (player.user.entity.isCasinoHelpShowed) {
        return;
    }

    player.user.entity.isCasinoHelpShowed = true;
    player.user.setGui('casinoenter');
});