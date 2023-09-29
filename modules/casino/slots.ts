import {CustomEvent} from "../custom.event";
import {slotMachineData} from "../../../shared/casino/slots";
import _ from 'lodash';
import {user} from "../../../client/modules/user";
import {system} from "../system";
import {runCasinoAchievWin} from "./achiev";
let slots = new Map<number, PlayerMp>();

CustomEvent.registerClient('casino:slots:enter', (player, id: number) => {
    if(player.user.getJobDress) return 'Zieh deine Arbeitskleidung aus, bevor du anfängst zu spielen';
    verifySlot(id);
    if(slots.get(id)) return false;
    slots.set(id, player);
    player.user.currentWeapon = null;
    return true;
})

const generateWin = () => {
    const winActions = _.shuffle(_.flatMap(slotMachineData.rulesPercentage, (winAction => Array(winAction.pct).fill(winAction))));

    const winAction = winActions[Math.floor(Math.random() * winActions.length)];

    const winStrings = slotMachineData.rulesMap[winAction.value];
    const winString = winStrings[Math.floor(Math.random() * winStrings.length)];

    const rule = slotMachineData.rules[winString];

    return {
        winString,
        rule,
        isWinBet: typeof rule === 'number'
    };
}

CustomEvent.registerClient('casino:slots:roll', (player, id: number, bet: number) => {
    const user = player.user;
    verifySlot(id);
    if(slots.get(id) != player) return null;
    if(user.chips < bet) {
        user.notify('Du hast nicht genug Chips für diese Wette', 'error');
        return null;
    }
    user.removeChips(bet, false, 'Einsatz im Spielautomaten');
    const {winString, rule, isWinBet} = generateWin();
    const winBalance = bet * rule;


    setTimeout(() => {
        if (player && mp.players.exists(player) && slots.get(id) == player) {
            if (isWinBet) {
                user.addChips(winBalance, true, 'Gewinnen am Spielautomaten');
                runCasinoAchievWin(player, 'Slots', winBalance)
            } else {
                player.notify(`Du hast verloren ${system.numberFormat(bet)}`, 'error');
            }
        }
    }, 5000);
    const nearest = user.getNearestPlayers();
    nearest.map(q => {
        CustomEvent.triggerClient(q, 'casino:slots:rollVisual', player.id, id, winString)
    })
    return [winString, isWinBet]
})

CustomEvent.registerClient('casino:slots:exit', (player, id: number) => {
    verifySlot(id);
    const q = slots.get(id)
    if(!q) return;
    if(q.id !== player.id) return;
    slots.delete(id);
})

const verifySlot = (id: number) => {
    const q = slots.get(id)
    if(!q) return;
    if(mp.players.exists(q)) return;
    slots.delete(id);
}