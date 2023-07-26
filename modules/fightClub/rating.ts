import { ScaleformTextMp } from '../scaleform.mp'
import { FIGHT_CLUB_RATING_TABLE_POS } from '../../../shared/fightClub'
import { systemUtil } from '../../../shared/system'
import { UserEntity } from '../typeorm/entities/user'
import { Like } from 'typeorm'

export class FightClubRating {
    private _table: ScaleformTextMp
    private _bestFighters: Array<UserEntity> = [] 
    
    constructor() {
        /** Табличка с рейтингом */
        this._table = new ScaleformTextMp(systemUtil.getVector3Mp(FIGHT_CLUB_RATING_TABLE_POS), "", {
            dimension: 0,
            type: 'board',
            rotation: new mp.Vector3(0, 0, FIGHT_CLUB_RATING_TABLE_POS.h),
            range: 40
        });
    }
    
    public async update(): Promise<void> {
        const usersWithFights = await UserEntity.find({
            where: {
                _stats: Like(`%fightClubWins%`)
            }
        })
        
        usersWithFights.sort(((a, b) => { return b.stats.fightClubWins - a.stats.fightClubWins ?? a.stats.fightClubLoses - b.stats.fightClubLoses }))
        this._bestFighters = usersWithFights.slice(0, 3)
        
        this.updateRatingText()
    }
    
    private updateRatingText(): void {
        this._table.text = `Лучшие бойцы \n1. ${this._bestFighters[0]?.rp_name ?? 'Пусто'} (${this._bestFighters[0]?.stats?.fightClubWins ?? 0} / ${this._bestFighters[0]?.stats?.fightClubLoses ?? 0})
        \n2. ${this._bestFighters[1]?.rp_name ?? 'Пусто'} (${this._bestFighters[1]?.stats?.fightClubWins ?? 0} / ${this._bestFighters[1]?.stats?.fightClubLoses ?? 0})
        \n3. ${this._bestFighters[2]?.rp_name ?? 'Пусто'} (${this._bestFighters[2]?.stats?.fightClubWins ?? 0} / ${this._bestFighters[2]?.stats?.fightClubLoses ?? 0})`
    }
}

export const ratingManager = new FightClubRating()
setTimeout(() => ratingManager.update(), 1500)