import clsx from 'clsx'
import { useI18n } from '../i18n'
import { scoreColor, TYPE_COLORS, fmt } from '../lib'

/* The dormitory drawn as a building: one row per floor, one tile per room.
   Tile width follows room capacity; the beds are dots coloured by resident
   type; the tile colour is the room's compatibility. */

export function FloorPlan({ floors, selected, onSelect, frameScores, highlight, compact = false }) {
  const { t } = useI18n()
  // every floor is drawn on the same scale: one bed = the same width
  const maxBeds = Math.max(...floors.map((f) => f.rooms.reduce((a, r) => a + r.capacity, 0)))
  return (
    <div className={clsx('flex flex-col-reverse', compact ? 'gap-1.5' : 'gap-2.5')}>
      {floors.map((f) => (
        <div key={f.floor} className="flex items-stretch gap-2">
          {!compact && (
            <div className="w-14 shrink-0 flex flex-col justify-center text-right pr-1">
              <span className="font-display text-sm font-bold">{f.floor}</span>
              <span className="text-[11px] muted">{f.gender === 'F' ? t('common.female') : t('common.male')}</span>
            </div>
          )}
          <div className="flex-1 flex gap-[3px] rounded-lg p-[3px] bg-line/50 dark:bg-night-line/60">
            {f.rooms.map((room) => {
              const score = frameScores ? frameScores[room.index] : room.score
              const shown = score != null && score >= 0 && (frameScores || room.residents.length > 1) ? score : null
              const isSel = selected === room.index
              const isHi = highlight != null && room.residents.some((r) => r.id === highlight)
              return (
                <button key={room.id} type="button"
                  onClick={onSelect ? () => onSelect(room.index) : undefined}
                  disabled={!onSelect}
                  aria-label={`${t('dorm.roomTitle', { id: room.id })}${shown != null ? `, ${fmt(shown)}` : ''}`}
                  aria-pressed={onSelect ? isSel : undefined}
                  className={clsx('relative rounded-[5px] flex flex-col justify-between text-left',
                    compact ? 'h-7 px-1 py-1' : 'h-16 px-1.5 py-1.5',
                    onSelect && 'cursor-pointer hover:brightness-95',
                    (isSel || isHi) && 'ring-2 ring-ink dark:ring-white ring-offset-1 ring-offset-paper dark:ring-offset-night z-10')}
                  style={{
                    flex: `0 0 calc(${(room.capacity / maxBeds) * 100}% - 3px)`, minWidth: 0,
                    background: shown == null ? 'var(--empty-room, rgba(255,255,255,.75))' : scoreColor(shown, 0.88),
                    transition: 'background-color 380ms ease',
                  }}>
                  {!compact && (
                    <span className="flex justify-between items-start text-[10px] font-semibold leading-none text-ink/80">
                      <span>{room.number}</span>
                      {room.smoking && <span title={t('common.smoking')}>🚬</span>}
                    </span>
                  )}
                  <span className="flex gap-[3px] flex-wrap">
                    {Array.from({ length: room.capacity }).map((_, k) => {
                      const r = room.residents[k]
                      return (
                        <span key={k} className={clsx('rounded-full', compact ? 'w-1.5 h-1.5' : 'w-2.5 h-2.5')}
                          style={r ? { background: TYPE_COLORS[r.cluster.id % TYPE_COLORS.length], boxShadow: '0 0 0 1.5px rgba(255,255,255,.9)' }
                            : { border: '1.5px dashed rgba(27,31,59,.35)' }} />
                      )
                    })}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ScoreLegend() {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2 text-xs muted">
      <span>{t('dorm.legend.low')}</span>
      <span className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${scoreColor(10)}, ${scoreColor(45)}, ${scoreColor(75)}, ${scoreColor(100)})` }} />
      <span>{t('dorm.legend.high')}</span>
    </div>
  )
}
