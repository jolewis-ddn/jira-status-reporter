const debug = require('debug')('Dashboard')

const config = require('config')

const JSR = require('./JiraStatusReporter')
const jsr = new JSR()

const JiraStatus = require('./JiraStatus')

let data = {}

class Dashboard {
    constructor() { }

    async getFieldCount() {
        const fields = await JiraStatus.getFields()
        return(fields.length)
    }

    async build() {
        const results = await Promise.all([
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND createdDate > -1d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND createdDate > -7d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND createdDate > -30d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND createdDate > -60d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND createdDate > -90d`,
                1
            ),

            jsr.bareQueryCount(
                `project = ${config.get('project')} AND updatedDate > -1d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND updatedDate > -7d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND updatedDate > -30d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND updatedDate > -60d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND updatedDate > -90d`,
                1
            ),

            jsr.bareQueryCount(
                `project = ${config.get('project')} AND issuetype=bug AND createdDate > -1d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND issuetype=bug AND createdDate > -7d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND issuetype=bug AND createdDate > -30d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND issuetype=bug AND createdDate > -60d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND issuetype=bug AND createdDate > -90d`,
                1
            ),

            jsr.bareQueryCount(
                `project = ${config.get('project')} AND issuetype=bug AND updatedDate > -1d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND issuetype=bug AND updatedDate > -7d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND issuetype=bug AND updatedDate > -30d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND issuetype=bug AND updatedDate > -60d`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${config.get('project')} AND issuetype=bug AND updatedDate > -90d`,
                1
            ),

            jsr.bareQueryCount(
                `project = ${
                config.get('project')
                } AND issuetype=bug AND status was in (DONE) DURING ("2020/08/27", "2020/08/28")`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${
                config.get('project')
                } AND issuetype=bug AND status was in (DONE) DURING ("2020/08/20", "2020/08/21")`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${
                config.get('project')
                } AND issuetype=bug AND status was in (DONE) DURING ("2020/07/27", "2020/07/28")`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${
                config.get('project')
                } AND issuetype=bug AND status was in (DONE) DURING ("2020/06/27", "2020/06/28")`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${
                config.get('project')
                } AND issuetype=bug AND status was in (DONE) DURING ("2020/05/27", "2020/05/28")`,
                1
            ),
            jsr.bareQueryCount(
                `project = ${
                config.get('project')
                } AND issuetype=bug AND status was in (DONE) DURING ("2020/05/26", "2020/05/27")`,
                1
            )
        ])

        debug(`dashboard results: ${results}`)
        
        this.data = {
            meta: {
                Categories: [
                    'Yesterday',
                    'Last 7 days',
                    'Last 30 days',
                    'Last 60 days',
                    'Last 90 days'
                ]
            },
            Fields: { Count: await this.getFieldCount() },
            Total: {
                Created: [results[0], results[1], results[2], results[3], results[4]],
                Updated: [results[5], results[6], results[7], results[8], results[9]],
                CreatedBugs: [
                    results[10],
                    results[11],
                    results[12],
                    results[13],
                    results[14]
                ],
                UpdatedBugs: [
                    results[15],
                    results[16],
                    results[17],
                    results[18],
                    results[19]
                ],
                ClosedBugs: [
                    results[20] - results[21],
                    results[21] - results[22],
                    results[22] - results[23],
                    results[23] - results[24],
                    results[24] - results[25]
                ]
            }
        }
        return (this)
    }

    buildCard(title, text) {
        return(`<div class='row'><div class='col-sm-3'><div class='card'><div class='card-body'><h5 class='card-title'>${title}</h5><p class='card-text'>${text}</p></div></div></div></div>`)
    }

    fetch(format) {
        if (format == "html") {
            let response = []
            response.push(this.buildCard('Field Count', this.data.Fields.Count))
            response.push(this.buildTable(this.data.meta.Categories, this.data.Total))
            return(response.join(''))
        } else {
            return(this.data)
        }
    }

    buildTable(titles, data) {
        let response = []
        response.push(`<table class='table table-responsive-md table-sm table-hover table-striped'><thead class='thead-dark'><tr><th></th>`)
        titles.forEach(t => { response.push(`<th>${t}</th>`) })
        response.push('</tr></thead><tbody>')
        for (const [key, val] of Object.entries(data)) {
            response.push(`<tr><th scope='row'>${key}</th><td>${val.join('</td><td>')}</td></tr>`)
        }
        response.push('</tbody></table>')
        return(response.join(''))
    }
}

module.exports = Dashboard
