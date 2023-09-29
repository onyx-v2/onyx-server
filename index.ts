import {warehouses} from "./modules/warehouse";
import {JobDress} from "./modules/job.dress";
import fs from 'fs';
import {initDatabaseConnection} from "./modules/typeorm"
import {loadVehicleConfigs, Vehicle} from './modules/vehicles'
import {inventory} from './modules/inventory'
import {business} from './modules/business'
import {houses} from './modules/houses';
import {dress} from './modules/customization';
import {system} from './modules/system';
import './modules/'
import {fractionChest} from "./modules/chest";
import {FractionGarage} from "./modules/fraction.garages";
import {fractionChestOrder} from "./modules/chest.order";
import {MoneyChestClass} from "./modules/money.chest";
import {race} from "./modules/race";
import {duels} from "./modules/duels";
import {fetchIp} from "./modules/web";
import {loadAdsDB} from "./modules/main";
import {loadGangZone} from "./modules/gangwar";
import {Family} from './modules/families/family';
import {loadAllVotes} from "./modules/vote";
import {Logs} from "./modules/logs";
import {loadTop3Drifters} from "./modules/drift";
import {marketItemsDb} from "./modules/market/marketItemsDb";
import {promocodes1x} from "./modules/onetimePromocodes";
import { initLogsDatabaseConnection } from './modules/typeorm/logs'
import {loadConfig} from "./modules/businesses/lsc";

process.env.TZ = 'Europe/Berlin'
mp.events.delayInitialization = true;
system.debug.success('Laden von Servermodulen')

initLogsDatabaseConnection()

initDatabaseConnection().then(async (q) => {
    await houses.load();
    if (fs.existsSync('./client_packages/dress.json.js')){
        system.debug.debug(`Die Bekleidungskonfiguration existiert, lösche sie`);
        fs.unlinkSync('./client_packages/dress.json.js');
    } else {
        system.debug.debug(`Bekleidungskonfigurationen gibt es nicht`);
    }
    await loadConfig()
    await dress.load();
    await business.load();
    await fetchIp()
    system.debug.success('Die vor der Initialisierung benötigten Grundmodule werden geladen');
    if(!mp.config.announce) mp.events.delayInitialization = false;
    await inventory.load();
    await loadVehicleConfigs()
    await Vehicle.spawnPlayersVehicles();
    await FractionGarage.loadAll()
    await MoneyChestClass.loadAll()
    await race.loadAll()
    await duels.loadAll()
    await JobDress.loadAll()
    await loadAdsDB()
    await Family.load();
    await fractionChest.loadAll()
    await fractionChestOrder.loadAll()
    await loadAllVotes()
    await warehouses.loadAll()
    await Logs.loadAll()
    await loadTop3Drifters()
    await marketItemsDb.init();
    await promocodes1x.load();
    loadGangZone()
    system.debug.success('Alle Module sind geladen');
    system.debug.success('--------------------');
    if (mp.config.announce) mp.events.delayInitialization = false;
});