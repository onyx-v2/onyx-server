import {colshapes} from "../../checkpoints";
import {PRISON_ENTER_MENU_COORDS, PRISON_TIME_FOR_WANTED_LEVEL} from "../../../../shared/prison/config";
import {menu} from "../../menu";
import {ARREST_MONEY} from "../../../../shared/economy";
import {prison} from "../index";
import {fractionCfg} from "../../fractions/main";

export function enterMenu() {
    colshapes.new(
        PRISON_ENTER_MENU_COORDS,
        "Registrierung von Festgenommenen",
        (player: PlayerMp, index) => {
            const user = player.user;
            if (!user) return;
            if (!user.is_police) return player.notify("Nur für Polizeibeamte verfügbar", "error");
            const m = menu.new(player, "Gefangenenbasis", "Registrierung von Festgenommenen");

            m.newItem({
                name: "Liste der aktuellen Gefangenen",
                onpress: () => {
                    const s = () => {
                        const submenu = menu.new(player, "Gefangenenbasis", "Liste der aktuellen Gefangenen");
                        mp.players.toArray().filter(target => target.user && target.user.prison && !target.user.prison.byAdmin).map(target => {
                            submenu.newItem({
                                name: `${target.user.name} (${target.user.id})`,
                                more: target.user.prison.time > 120 ? `${Math.floor(target.user.prison.time / 60)} min.` : `${target.user.prison.time} sec.`,
                                desc: `Причина: ${target.user.prison.reason}`,
                                onpress: () => {
                                    if (player.user.id === target.user.id)
                                        return player.notify("Du kannst dich nicht befreien", 'error');
                                    menu.accept(player, "ВDu willst den Gefangenen freilassen?").then(status => {
                                        if(!status) return s();
                                        if(!mp.players.exists(target)) return player.notify("Ein Spieler ist verschwunden", "error");
                                        target.user.writeRpHistory(`Er wurde aus dem Gefängnis entlassen [${fractionCfg.getFractionName(player.user.fraction)}-${player.user.id}], aufgrund von ${target.user.prison.reason}`);
                                        user.log('gosJob', `Aus der Haft entlassen. Daten über frühere Inhaftierungen - ${target.user.prison.time} Sekunden. Grund - ${target.user.prison.reason}`, target);
                                        prison.unjail(player, target.user.id)
                                        s();
                                    })
                                }
                            })
                        })
                        submenu.open();
                    }

                    s();
                }
            })

            m.newItem({
                name: "Einen Gefangenen registrieren",
                onpress: async () => {
                    const target = await user.selectNearestPlayer(5)
                    if(!target) return;
                    if (!target.user.cuffed) return player.notify("Der Gefangene muss mit Handschellen gefesselt werden.", "error");
                    if (!target.user.wanted_level) return player.notify("Der Gefangene passt in keines der Profile.", "error");

                    menu.input(player, "Gib den Grund für die Verhaftung ein", target.user.wanted_reason, 30).then(val => {
                        if(!val) return;
                        if(!mp.players.exists(target)) return player.notify("Der Gefangene ist verschwunden", "error");
                        if (!target.user.cuffed) return player.notify("Der Gefangene muss mit Handschellen gefesselt werden.", "error");
                        if (!target.user.wanted_level) return player.notify("Der Gefangene passt in keines der Profile.", "error");

                        prison.jail(player, target, target.user.wanted_level * PRISON_TIME_FOR_WANTED_LEVEL, val);
                        player.notify("Verhafteter wird ins Gefängnis gebracht", "success")
                    })
                }
            })


            m.open();
    }, {
            color: [0, 0, 0, 0]
        })
}