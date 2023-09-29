import {BusinessEntity} from "../typeorm/entities/business";
import {menu} from "../menu";
import {business, businessCatalogMenu, businessDefaultCostItem} from "../business";
import {deliverSet, needUnload, orderDeliverMenu} from "./order.system";
import {Vehicle} from "../vehicles";
import {canUserStartBizWar, createBizMenuBizWarItem, startBizWar} from "../bizwar";
import {writeClientRatingLog} from "./tablet";



export const openWashBuyMenu = (player: PlayerMp, item: BusinessEntity) => {
    const user = player.user
    const vehicle = player.vehicle;
    if(!user) return;

    if(!vehicle) {
        player.notify("Du musst in  einem Fahrzeug sein", "error");
        return false;
    }
    if (!user.isDriver) {
        player.notify("Du solltest fahren", "error")
        return false
    }
    if(Vehicle.getDirtLevel(vehicle) < 0.02) return player.notify('Die Fahrzeuge müssen nicht gewaschen werden', 'error');
    const cfg = item.catalog[0];


    user.tryPayment(cfg.price, 'all', () => {
        return player.vehicle == vehicle && user.isDriver && Vehicle.getDirtLevel(vehicle) >= 0.02
    }, 'Bezahlung der Autowäsche', `Автомойка #${item.id}`).then(status => {
        if(!status) return;
        Vehicle.setDirtLevel(vehicle, 0.0)
        player.notify('Der Transport ist sauber', 'success');
        writeClientRatingLog(player, item.id, cfg.price, "Autowäsche", 1);
        if(cfg.count > 0){
            cfg.count--;
            item.catalog = [cfg];
            //@ts-ignore
            business.addMoney(item, cfg.p, 'Autowäsche', false, false, true,
                true, businessDefaultCostItem(item, cfg.item));
        }
    })

}





export const washMenu = (player: PlayerMp, item: BusinessEntity) => {
    if (!player.user) return;
    const user = player.user;
    if (!user.isAdminNow(6) && 
        item.userId !== user.id && 
        !needUnload(player, item) &&
        !canUserStartBizWar(user)) return player.notify('Du hast keinen Zugang zur Unternehmensführung', 'error')
    let m = menu.new(player, "Autowäsche", user.isAdminNow(6) ? `Business #${item.id}` : "");

    if (needUnload(player, item)) {
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
                    washMenu(player, item)
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