import {menu, MenuClass} from "../menu";
import {promocodeBonuses} from "./bonuses";
import {BonusData, promocodes1x} from "./index";
import {system} from "../system";
import {writeSpecialLog} from "../specialLogs";

export function openPromocodesAdminMenu(player: PlayerMp) {
    const _menu = new MenuClass(player, 'Одноразовые промокоды');

    _menu.newItem({
        name: '~o~Erstellen Sie eine neue',
        onpress: () => {
            openCreatePromocodeMenu(player);
        }
    });

    promocodes1x.getAll().forEach(promocode => {
        _menu.newItem({
            name: (promocode.expiredAt > system.timestamp ? '~g~' : '~r~') + promocode.name,
            desc: 'Zum Löschen klicken',
            onpress: async () => {
                const isConfirmed = await menu.accept(player, `Bist du sicher, dass du den Promo-Code entfernen möchtest? ${promocode.name}`)
                if (isConfirmed) {
                    promocodes1x.delete(promocode.id);
                }

                openPromocodesAdminMenu(player);
            }
        });
    });

    _menu.open();
}

function openCreatePromocodeMenu(player: PlayerMp, name?: string, hours: number = 1, bonuses: BonusData[] = []) {
    const _menu = new MenuClass(player, 'Einen Promo-Code erstellen');

    _menu.newItem({
        name: 'Titel',
        more: name ? name : '~r~Es ist notwendig, Folgendes anzugeben',
        onpress: async () => {
            const newName = await menu.input(player, 'Promo Code Name', name, 15, 'text');
            if (newName) {
                name = newName;
            }

            openCreatePromocodeMenu(player, name, hours, bonuses);
        }
    });

    _menu.newItem({
        type: 'range',
        name: 'Время действия (ч)',
        rangeselect: [1, 999],
        listSelected: hours,
        onchange: (value) => {
            hours = value;
        }
    });

    _menu.newItem({
        name: 'Liste der Boni',
        onpress: () => {
            openBonusListMenu(player, bonuses, () => {
                openCreatePromocodeMenu(player, name, hours, bonuses);
            })
        }
    });

    _menu.newItem({
        name: '~g~Создать',
        onpress: async () => {
            _menu.close();

            const error = await promocodes1x.create(name, hours, bonuses);

            writeSpecialLog(`Ich habe einen einmaligen Promo-Code erstellt - ${name}`, player, 0);

            if (error) {
                player.notify(error, 'error');
                openCreatePromocodeMenu(player, name, hours, bonuses);
                return;
            }

            openPromocodesAdminMenu(player);
        }
    });

    _menu.open();
}

function openBonusListMenu(player: PlayerMp, bonuses: BonusData[], onClose: () => void) {
    const _menu = new MenuClass(player, 'Liste der Promo Code Boni');
    _menu.onclose = onClose;

    _menu.newItem({
        name: '~g~Eine neue hinzufügen',
        onpress: () => {
            openCreateBonusMenu(player,
                (bonus) => {
                    bonuses.push(bonus)
                },
                () => {
                    openBonusListMenu(player, bonuses, onClose);
                }
            );
        }
    });

    bonuses.forEach((bonus, index) => {
        _menu.newItem({
            name: promocodeBonuses.types.find(element => element.type === bonus.type).name,
            desc: 'Zum Löschen klicken',
            onpress: () => {
                bonuses.splice(index, 1);
                openBonusListMenu(player, bonuses, onClose);
            }
        })
    });

    _menu.open();
}

function openCreateBonusMenu(
    player: PlayerMp,
    addBonus: (bonus: BonusData) => void,
    onClose: () => void,
    selectedType: number = 0,
    data: any = { }
) {
    const _menu = new MenuClass(player, 'Hinzufügen eines Bonus zu einem Promo-Code');
    _menu.onclose = onClose;

    _menu.newItem({
        type: 'list',
        name: '~y~Typ',
        list: promocodeBonuses.types.map(element => element.name),
        listSelected: selectedType,
        onchange: (value) => {
            openCreateBonusMenu(player, addBonus, onClose, value);
        }
    });

    const bonus = promocodeBonuses.types[selectedType].bonus;
    bonus.addItemsToCreateMenu(player, _menu, data, () => {
        openCreateBonusMenu(player, addBonus, onClose, selectedType, data);
    });

    _menu.newItem({
        name: '~g~hinzufügen',
        onpress: () => {
            addBonus({ type: promocodeBonuses.types[selectedType].type, data });
            onClose();
        }
    });

    _menu.open();
}