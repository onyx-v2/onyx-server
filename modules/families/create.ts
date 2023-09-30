import {CustomEvent} from "../custom.event";
import {
    FAMILY_CREATE_COINS,
    FAMILY_CREATE_MONEY, FAMILY_CREATE_POS_CRIME,
    FAMILY_CREATE_POS_GOS,
    FamilyReputationType
} from "../../../shared/family";
import {PayType} from "../../../shared/pay";
import {colshapes} from "../checkpoints";
import {Family} from "./family";
import {system} from "../system";


enum PayTypeFamily {
    CASH = PayType.CASH,
    CARD = PayType.CARD,
    DONATE = 150
}
const createPosition = FAMILY_CREATE_POS_GOS


colshapes.new(new mp.Vector3(createPosition.x, createPosition.y, createPosition.z), 'Eine Familie gründen', (player) => {
    familyCreateGUI(player)
}, {
    drawStaticName: "scaleform",
    dimension: 0
})

/** Отобразить ГУИ создания семьи игроку */
export const familyCreateGUI = (player: PlayerMp) => {
    if(!mp.players.exists(player) || !player.user) return;
    if(player.user.family) return player.notify('Du kannst keine Familie gründen, weil du in einer anderen Familie bist.е')
    CustomEvent.triggerClient(player, 'family:create:start', [player.user.account.freeFamily ? 1 : FAMILY_CREATE_COINS, player.user.account.freeFamily ? 1 : FAMILY_CREATE_MONEY])
}

CustomEvent.registerCef('family:create', (player: PlayerMp, name: string, payType: PayTypeFamily, pin: string) => {
    if (!name || ! /^[a-zA-Z_-]{0,15}$/i.test(name)) {
        player.notify('Eine Familie mit dem gewählten Namen konnte nicht erstellt werden.', "error")
        return false
    }
    if (Family.getAll().find(f => f.name == name)) {
        player.notify('Es gibt bereits eine Familie mit diesem Namen', "error")
        return false;
    }
    let user = player.user;


    if(!user.account.freeFamily) {
        if (payType == PayTypeFamily.CASH) {
            if (user.money < FAMILY_CREATE_MONEY) {
                player.notify("Du hast nicht genug Geld", 'error');
                return false
            }
            user.removeMoney(FAMILY_CREATE_MONEY, true, 'Eine Familie gründen')
        }
        else if (payType == PayTypeFamily.CARD) {
            if (!user.verifyBankCardPay(pin)) {
                player.notify(`Entweder hast du den falschen Pin-Code eingegeben oder du hast deine Bankkarte nicht dabei`, 'error')
                return false
            }
            if (!user.tryRemoveBankMoney(FAMILY_CREATE_MONEY, true, 'Eine Familie gründen', `${name}`)) return false;
        }
        else if (payType == PayTypeFamily.DONATE) {
            if (!user.tryRemoveDonateMoney(FAMILY_CREATE_COINS, true, 'Eine Familie gründen')) return false;
        }
        else {
            system.debug.error('[Families] Versuch, eine nicht existierende Zahlungsart zu verwenden')
            return false
        }
    }


    Family.new(name).then((f) => {
        if(!user.exists) return;
        player.user.family = f
        player.user.familyRank = player.user.family.leaderRankID
        if(player.user.account.freeFamily) player.user.account.freeFamily = 0
        player.notify('Herzlichen Glückwunsch! Du hast eine Familie gegründet', "success")
    }).catch(r => {
        console.error('[ERROR] Fehler bei der Familienerstellung: ' + r);
        player.notify('Eine Familie konnte nicht erstellt werden. Kontaktiere die Serververwaltung.', "error")
    })
    return true;
})
