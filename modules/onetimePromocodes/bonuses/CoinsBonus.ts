import {IBonus} from "./IBonus";
import {menu, MenuClass} from "../../menu";

interface CoinsBonusData {
    amount: number
}

export class CoinsBonus implements IBonus<CoinsBonusData> {
    activate(player: PlayerMp, promocodeName: string, data: CoinsBonusData): void {
        player.user.addDonateMoney(data.amount, `Promo Code Aktivierung ${promocodeName.toUpperCase()}`);
    }

    addItemsToCreateMenu(player: PlayerMp, _menu: MenuClass, data: CoinsBonusData, updateMenu: () => void): void {
        if (!data.amount) {
            data.amount = 0
        }

        _menu.newItem({
            name: 'Menge',
            more: data.amount,
            onpress: async () => {
                const amount = await menu.input(player, 'Gib die Menge ein', 0, 7, 'int');
                if (amount && !isNaN(amount)) {
                    data.amount = amount;
                }

                updateMenu();
            }
        });
    }
}