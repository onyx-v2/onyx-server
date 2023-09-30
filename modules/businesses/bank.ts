import {BusinessEntity} from "../typeorm/entities/business";
import {menu} from "../menu";
import {system} from "../system";
import {inventory} from "../inventory";
import {account, User} from "../user";
import {
    BANK_CARD_NAME_LIST, bankAccountClose,
    bankCardCostCreate,
    bankCardMax,
    bankMaxPercent,
    newBankCardCost,
    REMOVAL_BANK_MONEY_PERCENT
} from "../../../shared/economy";
import {OWNER_TYPES} from "../../../shared/inventory";
import {CustomEvent} from "../custom.event";
import {business} from "../business";
import {createBizMenuBizWarItem} from "../bizwar";
import {BankTax, BankTaxes} from '../../../shared/atm';
import {Vehicle} from '../vehicles';

CustomEvent.registerCef('pin:check', async (player, card: string, pin: string) => {
    const user = player.user;

    if (user.bank_number != card) return false;
    if (!user.verifyBankCardPay(pin)) return false;
    
    return true;
})

CustomEvent.registerCef('atm:takeCash', (player, sum: number) => {
    const user = player.user;
    if (!user) return;
    if (user.tryRemoveBankMoney(sum, true, 'Bargeldabhebung', 'ATM')){
        const tax = ((sum / 100) * REMOVAL_BANK_MONEY_PERCENT);
        sum = sum - tax
        user.addMoney(sum, false, 'Geld von einem Bankkonto abgehoben');
        const mybank = user.myBank;
        if(mybank){
            business.addMoney(mybank, tax, 'Bargeldabhebung')
        }
    }
})

CustomEvent.registerCef('atm:changePin', (player, card: string, oldPin: string, newPin: string) => {
    const user = player.user;
    if(!user) return;
    if(!user.bank_number) return player.notify('Du hast kein Bankkonto', 'error');
    if(user.bank_number != card) return player.notify('Du hast kein Bankkonto', 'error');
    if(!user.verifyBankCardPay(oldPin)) return player.notify('Der alte Pin-Code ist nicht korrekt', 'error');
    if(oldPin == newPin) return player.notify('Der neue Pin-Code stimmt mit dem alten überein', 'error');
    player.notify('Pincode erfolgreich geändert', 'success');
    user.setNewBankPassword(newPin.toString());
})

CustomEvent.registerCef('bank:changeCard', (player, newCardIdx: number) => {
    const user = player.user;
    if (!user) return;
    if (!user.bank_number) return player.notify('Du hast kein Bankkonto', 'error');
    if (isNaN(newCardIdx) || newCardIdx < 0 || newCardIdx > 2) return player.notify('Du kannst diese Karte nicht neu ausstellen', 'error')
    const cost = bankCardCostCreate[newCardIdx]
    if (!cost || !user.tryRemoveBankMoney(cost, true, `Änderung des Kartentarifs ${BANK_CARD_NAME_LIST[newCardIdx]}`, 'Bank')) 
        return player.notify('Du hast nicht genügend Geld, um zu bezahlen', 'error');
    user.bank_tarif = newCardIdx;
    player.notify('Du hast deine Karte erfolgreich geändert');
})

CustomEvent.registerClient('atm:load', async player => {
    const user = player.user;
    if (!user) return;
    if (!user.bank_have && mp.players.exists(player)) player.notify('Du hast kein Bankkonto. Besorge dir eins bei der nächsten Bank', 'error')
    const history = await user.getBankHistory();
    if (mp.players.exists(player)) {
        user.setGui('atm')
        CustomEvent.triggerCef(player, 'atm:load', user.bank_number, history);
    }
})

CustomEvent.registerCef('bank:transfer', (player, sum: number, number: string) => {
    User.sendMoney(player, sum, number)
});
CustomEvent.registerCef('bank:reissue', (player, pin: string) => {
    const user = player.user;
    if (user.money < newBankCardCost) return player.notify("Du hast nicht genug Bargeld zur Hand", "error")

    user.removeMoney(newBankCardCost, true, 'Перевыпустил карту');

    let cardq = [...inventory.data].filter(q => q[1].serial === user.bank_number).map(it => {
        it[1].extra = null
        it[1].advancedNumber = 0
        it[1].save();
    });
    inventory.createItem({
        item_id: 801, owner_type: OWNER_TYPES.PLAYER, owner_id: user.id, serial: user.bank_number, extra: account.hashPassword(pin.toString()), advancedNumber: user.id
    });
    player.notify('Die Bankkarte wurde neu ausgestellt', 'success')
});

CustomEvent.registerCef('bank:witdraw', async (player, bankId: number, sum: number) => {
    const user = player.user;
    const item = await BusinessEntity.findOne(bankId);
    if (!sum) return;
    if (isNaN(sum) || sum < 0 || sum > 99999999) return player.notify("Der Betrag ist nicht korrekt", "error");
    if (sum > user.bank_money) return player.notify("Dieser Betrag übersteigt den Saldo", "error");
    user.removeBankMoney(sum, true, "Abhebung von Geldern in einer Bankfiliale", item.name);
    sum = sum - ((sum / 100) * REMOVAL_BANK_MONEY_PERCENT)
    user.addMoney(sum, false, 'Geld von einem Bankkonto abgehoben');
    player.notify('Die Operation war erfolgreich', 'success');
});

CustomEvent.registerCef('bank:deposit', async (player, bankId: number, sum: number) => {
    const user = player.user;
    const item = await BusinessEntity.findOne(bankId);
    if (!sum) return;
    if (isNaN(sum) || sum < 0 || sum > 99999999) return player.notify("Der Betrag ist nicht korrekt", "error");
    if (sum > user.money) return player.notify("Der angezeigte Betrag übersteigt deinen Kassenbestand", "error");
    if (bankCardMax[user.bank_tarif] && bankCardMax[user.bank_tarif] < (user.bank_money + sum)) return player.notify('Der Auffüllungsbetrag mit dem aktuellen Saldo übersteigt den für die Lagerung zulässigen Höchstbetrag', 'error');
    user.removeMoney(sum, true, 'Geld auf ein Bankkonto eingezahlt');
    user.addBankMoney(sum, true, "Kontoauffüllung in einer Bankfiliale", item.name);
    player.notify('Die Operation war erfolgreich', 'success');
});

CustomEvent.registerCef('bank:closeCard', (player) => {
    const user = player.user

    if (!user.tryRemoveBankMoney(bankAccountClose, true, `Ein Bankkonto schließen`, 'Банк'))
        return player.notify(`Um ein Konto zu schließen, musst du ${bankAccountClose}$ haben`, 'error');

    user.setGui(null)
    menu.accept(player, "Das Konto schließen?").then(status => {
        if (status) {
            if (user.bank_money) user.addMoney(user.bank_money, true, 'Das Bankkonto geschlossen');
            let cardq = [...inventory.data].find(q => q[1].serial === user.bank_number);
            if (cardq) {
                let card = cardq[1];
                card.extra = null
                card.advancedNumber = 0

                card.save();
            }
            user.bank_number = '';
            user.bank_tarif = 0;
            user.bank_money = 0;
            player.notify('Счёт закрыт', 'error')
        }
    })
});

CustomEvent.registerCef('bank:payTax', async (player, id: number, taxType: keyof BankTaxes) => {
    const user = player.user;
    switch (taxType) {
        case 'houses': {
            const house = user.house === id ? user.houseEntity : user.family?.house
            if (!house || house.tax === house.taxMax) return;

            const withdrawAmount = house.taxMax - house.tax;

            if (withdrawAmount <= 0) return player.notify("Das Haus ist maximal ausgelastet", "error");

            if (!user.tryRemoveBankMoney(withdrawAmount, true, `Zahlung der Haussteuer #${house.id}`, 'Steuerdienst'))
                return player.notify("Unzureichende Mittel auf dem Bankkonto", "error");
            house.tax = house.taxMax;
            await house.save()
            break;
        }
        case 'businesses': {
            if (!user.business || user.business.tax === user.business.taxMax) return;

            const withdrawAmount = user.business.taxMax - user.business.tax;

            if (withdrawAmount <= 0) return player.notify("Das Geschäft hat sich gelohnt", "error");

            if (!user.tryRemoveBankMoney(withdrawAmount, true, `Zahlung von Unternehmenssteuern #${user.business.id}`, 'Steuerdienst'))
                return player.notify("Unzureichende Mittel auf dem Bankkonto", "error");
            user.business.tax = user.business.taxMax;

            await user.business.save();
            break;
        }
        case 'warehouse': {
            if (!user.warehouse || !user.warehouseEntity.tax) return;

            const withdrawAmount = user.warehouseEntity.taxMax - user.warehouseEntity.tax;

            if (withdrawAmount <= 0) return player.notify("Lagerhaus maximal bezahlt", "error");

            if (!user.tryRemoveBankMoney(withdrawAmount, false, `Zahlung von Steuern an das Lagerhaus #${user.warehouseEntity.id}`, 'Steuerdienst'))
                return player.notify("Unzureichende Mittel auf dem Bankkonto", "error");

            user.warehouseEntity.tax = user.warehouseEntity.taxMax;
            await user.warehouseEntity.save();
            break;
        }
    }
    CustomEvent.triggerCef(player, 'bank:updateTax', id, taxType)
})

const getPlayerAvailableTaxes = (player: PlayerMp): BankTaxes => {
    const user = player.user;
    const taxes: BankTaxes = { houses: [], businesses: [], warehouse: [] }
    
    const personalHouse = user.houseEntity;
    if (personalHouse) taxes.houses.push({ id: personalHouse.id, name: 'Privatwohnung', maxTaxAmount: personalHouse.taxMax, taxAmountLeft: personalHouse.tax, address: personalHouse.name })

    const familyHouse = user.family?.house;
    if (familyHouse) taxes.houses.push({ id: familyHouse.id, name: 'Familie zu Hause', maxTaxAmount: familyHouse.taxMax, taxAmountLeft: familyHouse.tax, address: familyHouse.name })

    const warehouse = user.warehouseEntity;
    if (warehouse) taxes.warehouse.push({ id: warehouse.id, name: 'Zusammensetzung', maxTaxAmount: warehouse.taxMax, taxAmountLeft: warehouse.tax })
    
    return taxes;
}

export const bankMenu = (player: PlayerMp, item: BusinessEntity) => {
    if (!player.user) return;
    const user = player.user;
    let haveBankAcc = false;
    let haveBankAccInThisBank = false;
    let haveBankAccInSameBank = false;
    if (player.user.bank_number) {
        haveBankAcc = true;
        const [sub_type, bank_id, bank_tarif] = player.user.bank_number.toString().split('A').map(i => parseInt(i))
        if (sub_type == (item.sub_type + 1)) haveBankAccInSameBank = true;
        if (bank_id == item.id) haveBankAccInThisBank = true;
    }
    let m = menu.new(player, "", "");
    let sprite: "pacific" | "maze" | "fleeca" | "blane";
    switch (item.sub_type) {
        case 0:
            sprite = "pacific";
            break;
        case 1:
            sprite = "maze";
            break;
        case 2:
            sprite = "fleeca";
            break;
        case 3:
            sprite = "blane";
            break;
    }
    m.sprite = sprite;
    if (haveBankAccInThisBank) {
        player.user.setGui(
            'bank', 
            'bank:loadData', 
            item.id, 
            player.user.bank_tarif, 
            player.user.bank_number,
            getPlayerAvailableTaxes(player)
        )
    } else {
        m.newItem({
            name: "Eröffne ein Konto bei dieser Bank",
            more: ``,
            onpress: () => {
                if (haveBankAcc) {
                    menu.close(player);
                    if (haveBankAccInSameBank) return player.notify(`Du hast bereits ein Konto in einer anderen Filiale`, 'error');
                    else return player.notify(`Du hast bereits ein Konto bei einer anderen Bank`, 'error');
                }
                let submenu = menu.new(player, "", "Einen Tarifplan auswählen");
                submenu.sprite = sprite;
                
                BANK_CARD_NAME_LIST.map((q, index) => {
                    let tarif = index;
                    let cost = bankCardCostCreate[index];

                    submenu.newItem({
                        name: q,
                        desc: `Kosten für die Anmeldung: ${cost ? "$" + system.numberFormat(cost) : 'Es ist kostenlos'}, Maximale Guthabenreserve auf der Karte: $${bankCardMax[tarif] ? system.numberFormat(bankCardMax[tarif]) : "Unbegrenzt"}`,
                        icon: `bank_card_${tarif + 1}`,
                        onpress: () => {
                            menu.input(player, "Gib den Pin-Code ein", "", 4, "passwordNumber").then(pin => {
                                if (!(/^\d+$/.test(pin))) return player.notify("Im Feld für den Pin-Code sind nur Ziffern erlaubt", "error")
                                if(pin.length !== 4) return player.notify('4 Ziffern eingeben', 'error')
                                if (cost && user.money < cost) return player.notify('Du hast nicht genügend Geld, um zu bezahlen', 'error');
                                if (cost) user.removeMoney(cost, true, `Eröffnung eines Bankkontos bei einer Bank #${item.id}`)
                                let bank_number = (`${item.sub_type + 1}A${item.id}A${tarif}A${system.getRandomInt(1000000, 9999999)}`)
                                user.bank_number = bank_number
                                user.bank_tarif = tarif
                                inventory.createItem({
                                    item_id: 801, owner_type: OWNER_TYPES.PLAYER, owner_id: user.id, serial: bank_number, extra: account.hashPassword(pin), advancedNumber: user.id
                                });
                                player.notify("Du hast erfolgreich ein Bankkonto eröffnet");
                                submenu.close();
                            })
                        }
                    })
                })

                submenu.open();
            }
        })
    }
    if(item.userId === user.id || user.isAdminNow(6)){
        m.newItem({
            name: '~b~Business Management'
        })
        let percentList:string[] = [];
        if (item.param1 > bankMaxPercent){
            item.param1 = bankMaxPercent;
            item.save();
        }
        for (let q = 0; q < (bankMaxPercent + 1); q++) percentList.push(`${q}%`);
        m.newItem({
            name: "Prozentsatz für Unternehmensdienstleistungen",
            type: "list",
            list: percentList,
            listSelected: item.param1,
            onpress: (itm) => {
                item.param1 = itm.listSelected;
                item.save();
                player.notify("Du hast eine neue Servicegebühr festgelegt", "success");
            }
        })
    }

    createBizMenuBizWarItem(user, m, item);

    m.open();
}