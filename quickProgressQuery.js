const config = require('config')
const path = require('path')

const db = require('better-sqlite3')(`${config.dataPath}${path.sep}jira-stats.db`, { readonly: true })

const stmt = db.prepare(`/* Diff amount done */
select key,date,component,progress,total
from 'story-stats'
where (
	date='2021-07-25'
	and key in (select key from 'story-stats' where date='2021-07-18')
)
or date='2021-07-18'
order by key,date`)

const rows = stmt.all()

rows.forEach(row => {
    console.log(row.key, row.date, row.component, row.progress, row.total)
})

console.log(`Done`)
