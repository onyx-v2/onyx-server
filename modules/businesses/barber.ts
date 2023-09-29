import {BusinessEntity} from "../typeorm/entities/business";
import {menu} from "../menu";
import {CustomEvent} from "../custom.event";
import {deliverSet, needUnload, orderDeliverMenu} from "./order.system";
import {
    BarberData,
    getBarberItemDeafaultCost,
    getCatalogIdByComponent,
    getComponentCost
} from "../../../shared/barbershop";
import {business, businessCatalogMenu, businessDefaultCostItem} from "../business";
import {getAchievConfigBiz} from "../../../shared/achievements";
import {canUserStartBizWar, createBizMenuBizWarItem, startBizWar} from "../bizwar";

export const loadData = (player: PlayerMp, item: BusinessEntity) => {
    if(!player.user.mp_character) return player.notify('Du kannst den Barbershop nur nutzen, wenn du ein nicht standardisiertes Fell verwendest.', 'error')
    player.dimension = player.id + 1;
    player.user.reloadSkin()
    CustomEvent.triggerClient(player, 'barber:load', player.user.barbershopData, item.positions[0], item.catalog.map(q => {
        let price = q.count <= 0 ? getBarberItemDeafaultCost(q.item) : q.price
        return {...q, price}
    }), item.id, player.user.skin);
}

CustomEvent.registerClient('barber:close', player => {
    player.dimension = 0;
    player.user.reloadSkin()
})

CustomEvent.registerCef('barbershop:buy', (player, data:Partial<BarberData>, id: number) => {
    const user = player.user;
    if(!user) return;
    const item = business.get(id);
    if(!item) return;
    if(!player.dimension) return;
    const cost = finalySum(data, item);
    user.tryPayment(cost[0], 'all', () => true, 'Bezahlung für Friseurdienstleistungen', `Барбершоп #${item.id}`).then(q => {
        if(q){
            user.barbershopData = {...user.barbershopData, ...data};
            if(cost[1] > 0){
                business.addMoney(item, cost[1], `Bezahlung durch den Kunden ${player.dbid}`,
                    false, false, true, true, cost[3]);
                player.user.achiev.setAchievTickBiz(item.type, item.sub_type, cost[1])
                cost[2].map(itm => {
                    if(item.catalog.find(q => q.item === itm && q.count > 0)) item.removeItemCountByItemId(itm, 1);
                })
            }
        }
        loadData(player, item);
    })

})


const finalySum = (data: Partial<BarberData>, biz: BusinessEntity): [number, number, number[], number] => {
    let sum = 0;
    let sumBiz = 0;
    let used: number[] = [];
    let purchasePrice = 0;
    for(let key in data){
        const res = getComponentCost(key as keyof BarberData, biz.catalog)
        const id = getCatalogIdByComponent(key as keyof BarberData);
        const item = biz.catalog.find(q => q.item === id);
        if(item && (item.count - used.filter(s => s == id).length) >= 1){
            sum += res;
            sumBiz += res;
            used.push(id);

            purchasePrice += businessDefaultCostItem(biz, item.item);
        } else {
            sum += getBarberItemDeafaultCost(id);
        }
    }
    return [sum, sumBiz, used, purchasePrice];
}

export const barberMenu = (player: PlayerMp, item: BusinessEntity) => {
    if (!player.user) return;
    const user = player.user;
    const openShop = () => {
        // if (item.catalog.length == 0) return player.notify('Каталог салона на данный момент пустой', 'error');
        loadData(player, item)
    }
    if (!user.isAdminNow(6) && item.userId !== user.id && !needUnload(player, item) && !canUserStartBizWar(user)) 
        return openShop();
    let m = menu.new(player, "", user.isAdminNow(6) ? `Бизнес #${item.id}` : "");
    let sprite = "";
    switch (item.sub_type) {
        case 0:
            m.sprite = "shopui_title_barber";
            break;
        case 1:
            m.sprite = "shopui_title_barber2";
            break;
        case 2:
            m.sprite = "shopui_title_barber3";
            break;
        case 3:
            m.sprite = "shopui_title_barber4";
            break;
        default:
            m.title = 'Barbershop'
            break;
    }
    m.sprite = sprite as any;

    m.newItem({
        name: "Produktkatalog",
        onpress: () => {
            m.close();
            openShop()
        },
    })
    if (needUnload(player, item)){
        m.newItem({
            name: "~g~Auftrag abladen",
            onpress: () => {
                m.close();
                deliverSet(player)
            },
        })
    }

    createBizMenuBizWarItem(user, m, item);
    
    if (user.isAdminNow(6) || item.userId === user.id) {
        m.newItem({
            name: '~b~Business Management',
            onpress: () => {
                businessCatalogMenu(player, item, () => {
                    barberMenu(player, item)
                })
            }
        })
        m.newItem({
            name: '~g~Produktbestellung',
            onpress: () => {
                orderDeliverMenu(player, item)
            }
        })

    }


    m.open();
};