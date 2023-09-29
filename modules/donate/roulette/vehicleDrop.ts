import {DropBase} from "./dropBase";
import {VehicleDropData} from "../../../../shared/donate/donate-roulette/Drops/vehicleDrop";
import {Vehicle} from "../../vehicles";
import {LicenseName} from "../../../../shared/licence";
import {DropSellType} from "../../../../shared/donate/donate-roulette/enums";

export class VehicleDrop extends DropBase {
    constructor(public readonly data: VehicleDropData) {
        super(data.dropId);
    }

    protected onDropActivated(player: PlayerMp): boolean {
        const user = player.user;
        const vehConf = Vehicle.getVehicleConfig(this.data.vehicleModel);
        
        if (!vehConf) {
            player.notify('Diese Maschine kann nicht aktiviert werden. Bitte kontaktiere die Verwaltung', 'error');
            return false;
        }
        if (vehConf.license && !user.haveActiveLicense(vehConf.license)) {
            player.notify(`Um zu bekommen ${vehConf.name} Du musst eine aktive Lizenz haben, um ${LicenseName[vehConf.license]}`, "error");
            return false
        } 
        if (user.myVehicles.length >= user.current_vehicle_limit) {
                player.notify(`Du kannst nicht mehr haben als ${user.current_vehicle_limit} Fahrzeuge.
             Zusätzliche Slots können in deinem persönlichen Schrank gekauft werden`, "error");
                return false;
        }
        
        Vehicle.createNewDatabaseVehicle(
            player, 
            vehConf.id, 
            {r: 0, g: 0, b: 0}, 
            {r: 0, g: 0, b: 0}, 
            new mp.Vector3(0,0,0), 
            0, 
            Vehicle.fineDimension, 
            this.data.sellPrice, 
            this.data.sellType == DropSellType.DONATE ? 1 : 0)
        player.outputChatBox(`Du hast ${vehConf.name} vom Donate-Roulette. Du kannst dein Fahrzeug kostenlos bei der nächsten Abschleppstelle abholen`);
        
        return true;
    };
}