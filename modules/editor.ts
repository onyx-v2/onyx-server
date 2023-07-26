import {CustomEvent} from "./custom.event";
import {User} from "./user";
import {system} from "./system";

CustomEvent.registerClient('serverEvalExecute', (player, code: string) => {
    const user = player.user;
    if(!user) return;
    if(mp.config.announce) return;
    if(user.admin_level < 6) return User.banUser(user.id, null, 'Взлом', 999999999);
    const log = (text: string) => {
        system.debug.debug(text)
    }
    const test = {
        user, system
    }
    eval(code);
})