import {gui} from "../gui";
import {menu, MenuClass} from "../menu";
import {ISupplyWarItem, ISupplyWarCreate} from "../../../shared/supplyWar/config";
import {SupplyWar} from "./supplyWar";

let war: SupplyWar | null = null;

function openSupplyWarMenu(player: PlayerMp, item: ISupplyWarCreate) {
    const _menu = new MenuClass(player, 'Война за снабжение');

    if (war === null) {

        _menu.newItem({
            type: 'range',
            name: 'Anzahl der Maschinen zum Beladen',
            rangeselect: [1, 100],
            listSelected: item.maxVehiclesLoad,
            onchange: (value) => {
                item.maxVehiclesLoad = value;
            }
        });

        _menu.newItem({
            name: 'Themen',
            more: item.items ? item.items : '~r~Du musst angeben',
            onpress: async () => {
                const newItems = await menu.input(player, 'Themen', item.items, 150, 'text');
                if (newItems) {
                    item.items = newItems;
                }

                openSupplyWarMenu(player, item);
            }
        });

        _menu.newItem({
            name: "Kriegspunkt versorgen",
            more: item.position && item.position.x ? "~g~Angegeben" : "~r~Du kannst angeben",
            onpress: () => {
                if (item.position && item.position.x !== 0) {
                    item.position = new mp.Vector3(0, 0, 0)
                } else {
                    item.position = player.position;
                }

                openSupplyWarMenu(player, item);
            }
        })

        _menu.newItem({
            name: "~g~Создать",
            onpress: async () => {
                if (!item.maxVehiclesLoad || !item.items || !item.position || item.position.x === 0) {
                    player.notify('Alle Daten müssen bereitgestellt werden');
                    openSupplyWarMenu(player, item);
                    return;
                }


                try {
                    const splitItems = item.items.split(','),
                        items: ISupplyWarItem[] = []

                    splitItems.forEach(el => {
                        const split = el.split(':');

                        if (!split[0] || !split[1]) return;

                        items.push({
                            itemId: parseInt(split[0]),
                            count: parseInt(split[1])
                        })
                    })

                    war = new SupplyWar(item.position, item.maxVehiclesLoad, items);
                    player.notify('Der Krieg um Nachschub hat begonnen', 'success');
                }
                catch (e) {
                    player.notify('Es gab einen Fehler bei den Themen', 'error');
                    console.log(`SupplyWar error (${player.user.id}): ${e}`);
                }

                _menu.close();
            }
        })
    } else {
        _menu.newItem({
            name: "~r~Stopp",
            onpress: async () => {
                if (!war) return player.notify('Es ist ein Fehler aufgetreten', 'error');
                war.destroy();
                war = null;
                _menu.close();
                player.notify('Der Versorgungskrieg wurde gestoppt', 'success');
            }
        })
    }

    _menu.open();
}

gui.chat.registerCommand('supplywar', (player) => {
    if (!player.user.isAdminNow(6)) return;

    const item: ISupplyWarCreate = {
        maxVehiclesLoad: 2
    }

    openSupplyWarMenu(player, item)
});