import { menu } from '../menu'
import { fightClubManager } from './manager'
import { Fight, FightStage } from './fight'
import { BetType } from './bets/betType'
import { FIGHT_CLUB_MAX_BET_AMOUNT } from '../../../shared/fightClub'

/**
 * Открыть меню бойцовского клуба для игрока
 */
export const openFightClubMenu = (player: PlayerMp) => {
    if (!player.user) return
    
    const m = menu.new(player,  'Бойцовский клуб', '', [
        {
            name: `Боев в очереди: ${fightClubManager.fights.length}`
        },
        {
            name: 'Бои',
            onpress: _ => openFightListMenu(player)
        },
        {
            name: `Мой рекорд: ${player.user.entity.stats 
                ? `${player.user.entity.stats.fightClubWins ?? 0} / ${player.user.entity.stats.fightClubLoses ?? 0}` 
                : 'Нет данных'}`,
        },
        fightClubManager.getPlayerFight(player) ?
            {
                name: '~r~Отменить регистрацию',
                onpress: _ => fightClubManager.onPlayerLeave(player)
            }
            :
            {
                name: '~g~Зарегистрироваться на бой',
                onpress: _ => fightClubManager.addPlayerToQueue(player)
            },
        
    ])
    
    m.sprite = fightClubManager.mafiaOwner === 23 ? 'japan' : fightClubManager.mafiaOwner === 24 ? 'russian' : 'itali'
    m.open()
}

const openFightListMenu = (player: PlayerMp) => {
    if (!player.user) return

    const m = menu.new(player,  'Бойцовский клуб', '', fightClubManager.fights.map(f => {
        return {
            name: `${f.player1.user.name} VS ${f.player2?.user?.name ?? 'Неизвестно'}`,
            onpress: _ => openFightMenu(player, f)
        }
    }))
    
    //m.onclose = () => openFightClubMenu(player)    
    m.sprite = fightClubManager.mafiaOwner === 23 ? 'japan' : fightClubManager.mafiaOwner === 24 ? 'russian' : 'itali'
    m.open()
}

const openFightMenu = (player: PlayerMp, fight: Fight) => {
    if (!player.user) return

    const m = menu.new(player,  'Бойцовский клуб', '', [
        {
            name: fight.isFighting ? 'Статус: идёт' : 'Статус: подготовка',
        },
        {
            name: `Всего поставлено: ${fight.betting.totalBetsAmount}$`,
        },
        fight.currentStage === FightStage.Preparation ?
        {
            name: '~g~Сделать ставку (10 000$)',
            type: 'list',
            list: [`На победу ${fight.player1.user.name}`, `На победу ${fight.player2?.user?.name}`],
            onpress: async item => {
                if (fight.isFighting) {
                    return fightClubManager.notify(player, 'Ставки на бой', 'Бой уже начался, вы не можете сделать ставку сейчас')
                }
                if (item.listSelected === 0) fight.betting.addBet(player, 10000, BetType.Win1)
                else if (item.listSelected === 1) fight.betting.addBet(player, 10000, BetType.Win2)
            }
        } : null
    ])
    
    //m.onclose = () => openFightListMenu(player)
    m.sprite = fightClubManager.mafiaOwner === 23 ? 'japan' : fightClubManager.mafiaOwner === 24 ? 'russian' : 'itali'
    m.open()
}