import {BusinessEntity} from "../typeorm/entities/business";
import {menu} from "../menu";
import {BUSINESS_SUBTYPE_NAMES, BUSINESS_TYPE} from "../../../shared/business";
import {system} from "../system";
import {business, businessCatalogItemName, businessDefaultCostItem} from "../business";
import {
    ORDER_CAR_HEADING,
    ORDER_CAR_MODELS,
    ORDER_CAR_POS,
    ORDER_CONFIG,
    ORDER_LOAD_COORDS,
    ORDER_MENU_POS
} from "../../../shared/order.system";
import {colshapes} from "../checkpoints";
import {Vehicle} from "../vehicles";
import {User} from "../user";
import {LEVEL_PERMISSIONS} from "../../../shared/level.permissions";
import {MenuItem} from "../../../shared/menu";
import {JOB_TASK_MANAGER_EVENT} from "../battlePass/tasks/jobTaskManager";


export const order_list: { sum: number, comission: number, id: number, biz: number, items: [number, number][], time: number, deliver: number, fake?:true }[] = []

const createFakeOrder = (player: PlayerMp) => {
    const user = player.user;
    if (!user) return;
    if (order_list.find(item => !item.deliver && !item.fake)) return player.notify("Momentan kannst du nur Bestellungen aus der Liste annehmen", "error", "CHAR_BARRY");
    if (order_list.find(q => q.deliver === user.id)) return player.notify("Du hast bereits eine aktive Bestellung", "error", "CHAR_BARRY");
    const commission = system.getRandomInt(ORDER_CONFIG.NPC_DELIVER_COST_MIN, ORDER_CONFIG.NPC_DELIVER_COST_MAX);

    const biz = system.randomArrayElement(
        business.data
            .filter(b => [
                    BUSINESS_TYPE.FUEL,
                    BUSINESS_TYPE.DRESS_SHOP,
                    BUSINESS_TYPE.ITEM_SHOP,
                    BUSINESS_TYPE.BAR,
                    BUSINESS_TYPE.BARBER
                ].includes(b.type)
            )
            .filter(b => b.dimension === 0)
    );

    if(!biz) return;
    let deposit = ((commission / 100) * ORDER_CONFIG.ZALOG)
    if (!user.tryRemoveBankMoney(deposit, true, 'Sicherheiten für die Erfüllung des Auftrags', 'Lieferservice')) return;
    player.notify("Du hast die Bestellung erfolgreich abgeholt. Gehe zum freien Ladebereich, um die Bestellung zu laden", "success", "CHAR_BARRY");
    menu.close(player);
    order_list.push({
        sum: 0,
        comission: commission,
        id: system.personalDimension,
        biz: biz.id,
        items: [],
        time: system.timestamp,
        deliver: user.id,
        fake: true
    })
}

colshapes.new(ORDER_CAR_POS, 'Mietstation für Lieferfahrzeuge', (player, index) => {
    const user = player.user;
    if (!user) return;
    if (user.level < LEVEL_PERMISSIONS.DELIVER) return player.notify(`Miete verfügbar mit ${LEVEL_PERMISSIONS.DELIVER} LVL`)
    const m = menu.new(player, "Verleihstelle", "Действия");
    if (user.deliverJobCar && !mp.vehicles.exists(user.deliverJobCar)) user.deliverJobCar = null, user.deliverJobLoaded = false;

    if (user.deliverJobCar) {
        m.newItem({
            name: "Rücktransport",
            more: `$${system.numberFormat(ORDER_CONFIG.VEHICLE_RENT_RETURN)}`,
            onpress: () => {
                if (user.deliverJobCar && !mp.vehicles.exists(user.deliverJobCar)) user.deliverJobCar = null, user.deliverJobLoaded = false;
                if (!user.deliverJobCar) return player.notify("Du hast kein Mietauto", "error");
                if (user.deliverJobLoaded) return player.notify("Bevor du den Transport zurückbringst, nimm die zuvor aufgenommene Bestellung", 'error');
                user.addBankMoney(ORDER_CONFIG.VEHICLE_RENT_RETURN, true, 'Erstattungen für geleaste Fahrzeuge', 'Lieferservice')
                if (user.deliverJobCar && mp.vehicles.exists(user.deliverJobCar)) user.deliverJobCar.destroy();
                user.deliverJobCar = null
                user.deliverJobLoaded = false
                m.close();
            }
        })
    } else {
        ORDER_CAR_MODELS.map(([model, cost, level]) => {
            const name = Vehicle.getName(model);
            m.newItem({
                name,
                more: `$${system.numberFormat(cost)}`,
                desc: `Доступно с ${level} LVL`,
                onpress: () => {
                    //if (user.fraction) return player.notify("Нельзя работать в службе доставки работая в организации", 'error')
                    if (user.deliverJobCar) return player.notify("Du hast bereits ein geleastes Fahrzeug", "error");
                    if (!user.bank_have) return player.notify(`Du musst ein Bankkonto haben, um zu mieten`, 'error');
                    if(level && player.user.entity.deliver_level < level) return player.notify('Dieses Fahrzeug ist für dich nicht verfügbar', 'error');
                    if (!user.tryRemoveBankMoney(cost, true, 'Vermietung von Firmenfahrzeugen', 'Lieferservice')) return;

                    menu.close(player);
                    user.deliverJobCar = Vehicle.spawn(model, new mp.Vector3(ORDER_CAR_POS[index].x, ORDER_CAR_POS[index].y, ORDER_CAR_POS[index].z + 1), ORDER_CAR_HEADING, 0, true, false);
                    user.deliverJobLoaded = false
                    setTimeout(() => {
                        if (!mp.players.exists(player)) return;
                        if (!mp.vehicles.exists(user.deliverJobCar)) return;
                        player.user.putIntoVehicle(user.deliverJobCar, 0);
                    }, 500)
                }
            })
        })
    }

    m.open();
}, {
    radius: 3,
    type: 27
})

export const needUnload = (player: PlayerMp, biz: BusinessEntity) => {
    const user = player.user;
    if (!user) return false;
    if (user.deliverJobCar && !mp.vehicles.exists(user.deliverJobCar)) user.deliverJobCar = null, user.deliverJobLoaded = false;
    let item = order_list.find(q => q.deliver === user.id);
    if(!item) return false;
    if(item.biz !== biz.id) return false;

    return true;
}

export const deliverSet = (player: PlayerMp) => {
    const user = player.user;
    if (!user) return;
    if (user.deliverJobCar && !mp.vehicles.exists(user.deliverJobCar)) user.deliverJobCar = null, user.deliverJobLoaded = false;
    if (!user.deliverJobCar) return player.notify("Der Transport ist weg.", "error", "CHAR_BARRY");
    if (!user.deliverJobLoaded) return player.notify("Um die Bestellung auszuliefern - musst du die Bestellung zunächst in das Fahrzeug laden", "error", "CHAR_BARRY");
    if(player.dimension == 0 && system.distanceToPos(user.deliverJobCar.position, player.position) > 60) return player.notify('Der Transport ist zu weit weg', 'error');
    let item = order_list.find(q => q.deliver === user.id);
    if (!item) return player.notify("Du hast keine aktive Bestellung", "error", "CHAR_BARRY");
    const biz = business.get(item.biz);
    if (!biz) return;
    if(!item.fake){
        biz.reserve_money -= item.sum;
        const catalog = [...biz.catalog];
        item.items.map(([id, count]) => {
            const q = catalog.find(s => s.item === id);
            if(q) q.count+=count;
        })
        biz.catalog = catalog;
        if (biz.userId){
            const owner = User.get(biz.userId);
            if (owner) owner.notify("Die Bestellung für dein Unternehmen wurde erfolgreich ausgeliefert", "success", "CHAR_BARRY");
        }
        biz.save();
    }
    let zalog = ((item.comission / 100) * ORDER_CONFIG.ZALOG)
    let comission = item.comission;
    let multiple = 0;
    if(player.user.entity.deliver_level > 0) multiple = (comission / 100 * (ORDER_CONFIG.PERCENT_COST_ADD_PER_LEVEL * player.user.entity.deliver_level))
    player.user.entity.deliver_total++;
    player.user.entity.deliver_current++;
    if(player.user.entity.deliver_current >= ORDER_CONFIG.LEVEL_STEP){
        player.user.entity.deliver_current = 0;
        player.user.entity.deliver_level = player.user.entity.deliver_level + 1;
    }
    player.user.achiev.achievTickByType("deliverCount")
    player.user.achiev.achievTickByType("deliverSum", comission)
    mp.events.call(JOB_TASK_MANAGER_EVENT, player, 'trucker')
    user.addBankMoney(comission, true, 'Bezahlung der Lieferung', 'Lieferservice')
    setTimeout(() => {
        if(multiple){
            user.addBankMoney(multiple, true, 'Niveauzulage', 'Lieferservice')
        }
        user.addBankMoney(zalog, true, 'Erstattung der Kaution', 'Lieferservice')
    }, 3000)
    user.deliverJobLoaded = false
    if(order_list.findIndex(q => q.id === item.id) > -1)order_list.splice(order_list.findIndex(q => q.id === item.id), 1);
}


colshapes.new(ORDER_MENU_POS, 'Produktlieferung', player => {
    const user = player.user;
    if (!user) return;
    if (user.deliverJobCar && !mp.vehicles.exists(user.deliverJobCar)) user.deliverJobCar = null, user.deliverJobLoaded = false;
    const m = menu.new(player, "Auswahl bestellen", "Liste");
    m.newItem({
        name: 'Dein Trucker-Level',
        more: `${user.entity.deliver_level} LVL (${player.user.entity.deliver_current} / ${ORDER_CONFIG.LEVEL_STEP})`
    })
    m.newItem({
        name: "Nimm eine zufällige Reihenfolge",
        desc: `Zufällige Reihenfolge der $${system.numberFormat((ORDER_CONFIG.NPC_DELIVER_COST_MIN))} vor $${system.numberFormat(ORDER_CONFIG.NPC_DELIVER_COST_MAX)}. Pfand - ${ORDER_CONFIG.ZALOG}%`,
        onpress: () => {
            if (!user.deliverJobCar) return player.notify("Ein Servicetransport ist erforderlich, um die Bestellung entgegenzunehmen", "error", "CHAR_BARRY");
            createFakeOrder(player)
        }
    })
    order_list.map(item => {
        if (item.deliver) return;
        if (item.fake) return;
        if ((item.time + (ORDER_CONFIG.AFK_TIME * 50)) < system.timestamp) return;

        const biz = business.get(item.biz);
        if (!biz) return;
        let zalog = ((item.comission / 100) * ORDER_CONFIG.ZALOG)
        m.newItem({
            name: `${BUSINESS_SUBTYPE_NAMES[biz.type][biz.sub_type]}`,
            more: `+$${system.numberFormat(item.comission)}`,
            desc: `Залог: $${system.numberFormat(zalog)}`,
            onpress: () => {
                if (!user.deliverJobCar) return player.notify("Ein Servicetransport ist erforderlich, um die Bestellung entgegenzunehmen", "error", "CHAR_BARRY");
                if (item.deliver) return player.notify("Jemand anderes hat diese Bestellung bereits angenommen", "error", "CHAR_BARRY");
                if (order_list.find(q => q.deliver === user.id)) return player.notify("Du hast bereits eine aktive Bestellung", "error", "CHAR_BARRY");
                if (!user.tryRemoveBankMoney(zalog, true, 'Sicherheiten für die Erfüllung des Auftrags', 'Lieferservice')) return;
                item.deliver = user.id;
                player.notify("Du hast die Bestellung erfolgreich abgeholt. Gehe zum freien Ladebereich, um die Bestellung zu laden", "success", "CHAR_BARRY");
                menu.close(player);
            }
        })

    })

    m.open();
}, {
    radius: 3,
    type: 27
})

colshapes.new(ORDER_LOAD_COORDS, 'Ladefläche', (player, index) => {
    const user = player.user;
    if (!user) return;
    if (user.deliverJobCar && !mp.vehicles.exists(user.deliverJobCar)) user.deliverJobCar = null, user.deliverJobLoaded = false;
    if (!user.deliverJobCar) return player.notify("Ein Servicetransport ist erforderlich, um die Bestellung entgegenzunehmen", "error", "CHAR_BARRY");
    const veh = user.deliverJobCar;
    if(user.deliverJobLoaded) return player.notify("Die Bestellung wurde bereits geladen", 'error')
    if(mp.labels.toArray().find(q => q.deliver === index)) return player.notify("Die Ladezone ist besetzt", 'error')
    const check = () => {
        if(!mp.players.exists(player)) return false;
        if (user.deliverJobCar && !mp.vehicles.exists(user.deliverJobCar)) user.deliverJobCar = null, user.deliverJobLoaded = false;
        if (!user.deliverJobCar){
            player.notify("Ein Servicetransport ist erforderlich, um die Bestellung entgegenzunehmen", "error", "CHAR_BARRY");
            return false
        }
        let item = order_list.find(q => q.deliver === user.id);
        if (!item) {
            player.notify("Du hast keine aktive Bestellung", "error", "CHAR_BARRY");
            return false;
        }
        if (user.deliverJobLoaded){
            player.notify("Die Bestellung wurde bereits geladen", "error", "CHAR_BARRY");
            return false;
        }
        if(!mp.vehicles.exists(veh)){
            player.notify("Der Transport ist weg", "error", "CHAR_BARRY");
            return false;
        }
        if (system.distanceToPos2D(veh.position, ORDER_LOAD_COORDS[index]) > 5){
            player.notify("Kein Transport in der Ladezone", "error", "CHAR_BARRY");
            return false;
        }
        return true;
    }
    if (!check()) return;
    player.notify("Das Laden dauert 30 Sekunden. Bereithalten", "error");
    let t = 30;
    let text = mp.labels.new(`Laden: ${t}`, ORDER_LOAD_COORDS[index], {
        dimension: player.dimension,
        drawDistance: 5,
        los: false
    })
    text.deliver = index
    let int = setInterval(() => {
        let q = check();
        t--;
        if (mp.labels.exists(text)) text.text = `Laden: ${t}`;
        if (t <= 0 || !q){
            if (mp.labels.exists(text)) text.destroy();
            clearInterval(int);
            if(!t){
                user.deliverJobLoaded = true;
                const biz = business.get(order_list.find(q => q.deliver === user.id).biz);
                if(!biz) return player.notify("Es gab einen Fehler bei der Standortsuche", "error");
                player.notify("Die Route befindet sich in deinem Navigator. Versuche, die Ware so schnell wie möglich abzuliefern.", "success");
                user.setWaypoint(biz.positions[0].x, biz.positions[0].y, biz.positions[0].z, 'Produktlieferung', true);
            }
        }
    }, 1000)
}, {
    radius: 5,
    type: 27
})

mp.events.add('playerQuit', player => {
    const user = player.user;
    if (!user) return;
    if (user.deliverJobCar && mp.vehicles.exists(user.deliverJobCar)) user.deliverJobCar.destroy();
    const index = order_list.findIndex(q => q.deliver === user.id)
    if(index == -1) return;
    let item = order_list[index];
    if(!item) return;
    if(item.fake) order_list.splice(index, 1)
    else order_list[index].deliver = null;
})


const getOrderSum = (biz: BusinessEntity, order: Map<number, number>) => {
    const items: [number, number][] = [];
    order.forEach((count, id) => {
        items.push([id, count])
    });

    let sum = 0;
    items.map(([item, count]) => {
        if (count == 0) return;
        let cost = businessDefaultCostItem(biz, item, count)
        sum += cost
    })
    if(biz.upgrade > 0 && [BUSINESS_TYPE.BAR, BUSINESS_TYPE.ITEM_SHOP, BUSINESS_TYPE.BARBER, BUSINESS_TYPE.TATTOO_SALON, BUSINESS_TYPE.FUEL, BUSINESS_TYPE.DRESS_SHOP, BUSINESS_TYPE.TUNING].includes(biz.type)){
        sum = sum - (sum / 100 * (biz.upgrade * 10))
    }
    return sum
}

type BusinessCatalogFilterFunc = (
    businessEntity: BusinessEntity,
    catalog: typeof BusinessEntity.prototype.catalog
) => typeof BusinessEntity.prototype.catalog;

function createFilterByItemName(itemName: string): BusinessCatalogFilterFunc {
    const lowerCaseName = itemName.toLowerCase();

    return function (
        businessEntity: BusinessEntity,
        catalog: typeof BusinessEntity.prototype.catalog
    ) {
        return catalog.filter(item =>
            businessCatalogItemName(businessEntity, item.item)
                .toLowerCase().includes(lowerCaseName)
        )
    }
}

function createFilterByCountOnStock(lessThenCount: number): BusinessCatalogFilterFunc {
    return function (
        businessEntity: BusinessEntity,
        catalog: typeof BusinessEntity.prototype.catalog
    ) {
        return catalog.filter(item => item.count <= lessThenCount);
    }
}

export const orderDeliverMenu = (player: PlayerMp, biz: BusinessEntity) => {
    const user = player.user;
    if (!user) return;
    if (order_list.find(q => q.biz === biz.id && !q.fake)) return player.notify("Du hast bereits eine aktive Bestellung. Warte darauf, dass sie erfüllt wird", "error")
    let order = new Map<number, number>();
    let catalogFilter: BusinessCatalogFilterFunc = null;

    const sm = () => {
        const m = menu.new(player, "Auftragserteilung", "");

        const orderSumMenuItem: MenuItem = {
            name: 'Betrag bestellen',
            more: `$${getOrderSum(biz, order)}`
        };

        const updateOrderSum = () => {
            orderSumMenuItem.more = `$${getOrderSum(biz, order)}`;
            m.updateItem(orderSumMenuItem);
        };

        const catalog = catalogFilter == null
            ? biz.catalog
            : catalogFilter(biz, biz.catalog);

        m.newItem({
            name: '~o~Nach Lagermenge filtern',
            onpress: () => {
                menu.input(player, 'Auf Lager für weniger als...', 0, 6, 'int').then(count => {
                    catalogFilter = createFilterByCountOnStock(count);
                    sm();
                });
            }
        });

        m.newItem({
            name: '~o~Nach Namen filtern',
            onpress: () => {
                menu.input(player, 'Produktname', "", 20, 'text').then(name => {
                    catalogFilter = createFilterByItemName(name);
                    sm();
                });
            }
        });

        m.newItem({
            name: '~r~Filter zurücksetzen',
            onpress: () => {
                catalogFilter = null;
                sm();
            }
        });

        catalog.map(item => {
            const canMax = item.max_count - item.count
            let name = businessCatalogItemName(biz, item.item)
            m.newItem({
                name,
                type: "range",
                desc: `Ändere sie einzeln mit den Links-Rechts-Pfeiltasten oder gib eine neue Menge ein, indem du Enter drückst. Du hast auf Lager ${item.count} / ${item.max_count}`,
                rangeselect: [0, canMax],
                listSelected: order.has(item.item) ? order.get(item.item) : 0,
                onchange: (val) => {
                    if (val) order.set(item.item, val)
                    else order.delete(item.item);

                    updateOrderSum();
                },
                onpress: () => {
                    menu.input(player, 'Gib die Menge ein', order.has(item.item) ? order.get(item.item) : 0, 6, 'int').then(count => {
                        if(typeof count !== "number") return;
                        if(!count && count !== 0) return;
                        if(count < 0) return;
                        if(count > canMax) return;
                        if(count) order.set(item.item, count)
                        else order.delete(item.item)
                        sm();
                    })
                }
            })
        })

        m.newItem(orderSumMenuItem);

        m.newItem({
            name: '~g~Zur Kasse gehen',
            desc: 'Die Zahlung muss vom Geschäftskonto erfolgen. Im Falle einer Nichtlieferung wird das Geld zurückerstattet.',
            onpress: () => {
                const sum = getOrderSum(biz, order);
                if (!sum) return player.notify("Um eine Bestellung aufzugeben, gib bitte die zu bestellenden Artikel an", "error");
                if (sum < 10000) return player.notify("Der Bestellwert darf nicht weniger als $10000 betragen", "error");
                if (order_list.find(q => q.biz === biz.id)) return player.notify("Du hast bereits eine aktive Bestellung. Warte darauf, dass sie erfüllt wird", "error"), menu.close(player);
                const submenu = menu.new(player, "Auftragserteilung", "Результат");
                const comission = ((sum / 100) * ORDER_CONFIG.COMISSION)
                submenu.newItem({
                    name: "Menge der Produktion",
                    more: `$${system.numberFormat(sum)}`
                })
                submenu.newItem({
                    name: "Lieferdienste",
                    more: `$${system.numberFormat(comission)}`
                })
                submenu.newItem({
                    name: "Gesamtbetrag",
                    more: `$${system.numberFormat(sum + comission)}`
                })

                const resItems: [number, number][] = [];
                order.forEach((count, id) => {
                    resItems.push([id, count])
                });

                submenu.newItem({
                    name: "~g~Arrangement",
                    onpress: () => {
                        if (order_list.find(q => q.biz === biz.id)) return player.notify("Du hast bereits eine aktive Bestellung. Warte darauf, dass sie erfüllt wird", "error"), menu.close(player);
                        if (biz.money < sum) return player.notify("Das Geschäftskonto ist nicht ausreichend gedeckt, um diese Bestellung zu bezahlen", "error")
                        order_list.push({
                            sum: sum + comission,
                            comission,
                            id: system.personalDimension,
                            biz: biz.id,
                            items: resItems,
                            time: system.timestamp,
                            deliver: 0
                        })
                        business.removeMoney(biz, sum + comission, 'Bezahlung der Produktbestellung', true)
                        menu.close(player);
                        player.notify("Die Bestellung wurde erfolgreich aufgegeben", "success");
                    }
                })

                submenu.open();
            }
        })

        m.open();
    }

    sm();

}

setInterval(() => {
    const current = system.timestamp;
    order_list.map((item, index) => {
        if (item.deliver) return;
        if ((item.time + (ORDER_CONFIG.AFK_TIME * 60)) < current) {
            if(!item.fake){
                const biz = business.get(item.biz);
                if (!biz) return;
                biz.reserve_money -= item.sum;
                const catalog = [...biz.catalog];
                item.items.map(([id, count]) => {
                    const q = catalog.find(s => s.item === id);
                    if (q) q.count += count;
                })
                biz.catalog = catalog;
                if (biz.userId) {
                    const owner = User.get(biz.userId);
                    if (owner) owner.notify("Die Bestellung für dein Unternehmen wurde erfolgreich ausgeliefert", "success", "CHAR_BARRY");
                }
            }
            order_list.splice(index, 1)
        }
    })
}, 60000)