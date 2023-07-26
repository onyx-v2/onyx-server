import { FIST_WEAPON_HASH } from '../../../shared/fightClub'
import { fightClubManager } from './manager'

mp.events.add('playerDeath', (player: PlayerMp, reason: any, killer: PlayerMp) => {
    if (!player.user) return
    fightClubManager.onPlayerKilled(player)
})

mp.events.add('playerQuit', (player: PlayerMp) => {
    if (!player.user) return
    fightClubManager.onPlayerLeave(player)
})