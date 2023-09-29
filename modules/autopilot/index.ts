import { CustomEvent } from "../custom.event";

CustomEvent.registerClient('autopilot:isInstalled', (player) => {
    if (!player.vehicle)
        return player.notify('Du musst im Auto sein, um den Autopiloten zu aktivieren', 'error');

    if (player.seat !== 0)
        return player.notify('Du musst auf dem Fahrersitz sitzen, um den Autopiloten zu aktivieren', 'error');

    if (!player.vehicle.engine)
        return player.notify('Der Autopilot darf nicht benutzt werden, wenn der Motor ausgeschaltet ist', 'error');

    if (!player.vehicle?.entity?.data)
        return player.notify('Es gibt keinen Autopiloten im Auto', 'error');

    if (!player.vehicle.entity.data.isAutopilotInstalled)
        return player.notify('Es gibt keinen Autopiloten im Auto', 'error');

    CustomEvent.triggerClient(player, 'autopilot:toggle');
});