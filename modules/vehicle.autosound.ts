import {MusicPlayer} from "./musicPlayer";
import {CustomEvent} from "./custom.event";

export function openAutoSoundMenu(player: PlayerMp, vehicle: VehicleMp) {
    if (vehicle.entity && !vehicle.entity.musicPlayer) {
        vehicle.entity.musicPlayer = new VehiclePlayer(vehicle);
    }

    vehicle.entity.musicPlayer.openForPlayer(player);
}

CustomEvent.registerClient('vehicle:sound:add', (player, vehicleIds: number[]) => {
    for (let vehicleId of vehicleIds) {
        const vehicle = mp.vehicles.toArray().find(veh => veh.id === vehicleId);
        if (!vehicle || !vehicle.entity || !vehicle.entity.musicPlayer) {
            continue;
        }

        vehicle.entity.musicPlayer.addPlayer(player);
    }
});

CustomEvent.registerClient('vehicle:sound:remove', (player, vehicleIds: number[]) => {
    for (let vehicleId of vehicleIds) {
        const vehicle = mp.vehicles.toArray().find(veh => veh.id === vehicleId);
        if (!vehicle || !vehicle.entity || !vehicle.entity.musicPlayer) {
            continue;
        }

        vehicle.entity.musicPlayer.removePlayer(player);
    }
});

function getVehiclePlayerId(vehicle: VehicleMp): string {
    return `veh_${vehicle.entity?.id || 10000000}`;
}

export class VehiclePlayer extends MusicPlayer {
    private readonly vehicle: VehicleMp;

    constructor(vehicle: VehicleMp) {
        super(getVehiclePlayerId(vehicle));

        this.vehicle = vehicle;
        this.vehicle.entity.musicPlayer = this;
        this.vehicle.setVariable('musicPlayerEnabled', true);
    }

    destroy() {
        super.destroy();

        if (!this.isExists()) {
            return;
        }

        if (this.vehicle.entity) {
            this.vehicle.entity.musicPlayer = null;
        }

        this.vehicle.setVariable('musicPlayerEnabled', false);
    }

    getAttachEntityInfo(): { id: number; type: "object" | "vehicle" } {
        return {id: this.vehicle.id, type: 'vehicle'};
    }

    isPlayerHasAccess(player: PlayerMp): boolean {
        return player.vehicle === this.vehicle && player.seat === 0;
    }

    takePlayer(player: PlayerMp): void {
        return player.notify('Im Moment kann der Spieler nicht aus dem Auto genommen werden', 'error');
    }
}