"use strict";
const debug = require('debug')('MermaidNodes')
const mermaidConfig = require('./config/mermaid-config')

const JiraStatus = require('./JiraStatus')

let idSource = "unset"
let nameSource = "unset"
let idTarget = "unset"
let nameTarget = "unset"

/**
 *cleanName: Removes all parenthesis marks from input string.
 *  Mermaid labels cannot contain parens
 *
 * @param {*} inName
 * @returns modified string (no parens)
 */
function cleanName(inName) {
    let cleanName = inName
    cleanName = cleanName.replace(/\(/g, "").replace(/\)/g, "")
    return (cleanName.replace(/\"/g, ""))
}

/**
 *removeSpaces: Deletes all spaces from the specified string. 
 * Mermaid Class names cannot contain strings
 *
 * @param {*} text
 * @returns modified string (no spaces)
 */
function removeSpaces(text) {
    return (text.replace(/\s/g, ""))
}

const RED_STATUSES = ['ICEBOX', 'DEFINED', 'IN PROGRESS', 'IN REVIEW', 'DONE', 'EMERGENCY', 'BLOCKED', 'DEAD']

class MermaidNodes {
    /**
     *Creates an instance of MermaidNodes.
     * @memberof MermaidNodes
     */
    constructor() {
        debug("mermaidNodes created")
        this.nodes = []
        this.statuses = {}

        RED_STATUSES.forEach((status) => {
            this.statuses[status] = []
        })
    }

    /**
     *addLink: Update the list of nodes with the specified source and target details
     *
     * @param {*} idSource
     * @param {*} nameSource
     * @param {*} idTarget
     * @param {*} nameTarget
     * @param {*} statusTarget: Used to track the IDs by Status
     * @memberof MermaidNodes
     */
    addLink(idSource, nameSource, idTarget, nameTarget, statusTarget) {
        debug("node created")
        this.nodes.push({ idSource: idSource, nameSource: nameSource, idTarget: idTarget, nameTarget: cleanName(nameTarget) })
        this.appendStatus(idTarget, statusTarget)
    }

    /**
     *appendStatus: Update the status array with the specified ID and Status
     *
     * @param {*} id
     * @param {*} status
     * @memberof MermaidNodes
     */
    appendStatus(id, status) {
        if (!this.statuses[status]) {
            this.statuses[status] = []
        }
        this.statuses[status].push(id)
    }

    /**
     *setRootName: Corrects or updates name of the root Defaults to 0
     *
     * @param {*} name
     * @memberof MermaidNodes
     */
    setRootIdAndName(id, name) {
        debug(`setRootIdAndName(${id}, ${name}) called...`)
        name = cleanName(name)
        this.nodes.forEach((node) => {
            if (node.idSource == 0) {
                node.isSource = id
                node.nameSource = name
            } else if (node.idTarget == 0) {
                node.isTarget = id
                node.nameTarget = name
            }
        })
    }

    /**
     *getContent: Create the Mermaid file content from the stored data
     *
     * @returns Mermaid-formatted text
     * @memberof MermaidNodes
     */
    getContent() {
        let resp = []
        resp.push("graph LR;")

        resp.push("") // For readability
        this.nodes.forEach((node) => {
            resp.push(`  ${node.idSource}(${node.nameSource})-->${node.idTarget}(${node.nameTarget});`)
        })

        resp.push("") // Need a blank line before the Class definitions
        for (var f in mermaidConfig.formats) {
            if (mermaidConfig.formats.hasOwnProperty(f)) {
                resp.push(`classDef ${removeSpaces(f)} ${mermaidConfig.formats[f]}`)
            }
        }

        resp.push("") // Need a blank line before the id/status list
        for (var s in this.statuses) {
            if (this.statuses[s].length > 0) {
                resp.push(`class ${this.statuses[s].join(',')} ${removeSpaces(s)}`)
            }
        }

        // Merge all the results and return it
        return (resp.join("\n"))
    }

    static buildMermaidLinkIn(
        inKey,
        inSummary,
        inStatus,
        linkOutward,
        issueLabel,
        issueType,
        fontawesomeIcon,
        cssClass
    ) {
        return `${inKey}("${fontawesomeIcon}${inKey} ${inSummary}"):::${cssClass} -->|${linkOutward}| ${issueLabel}`
    }

    static buildMermaidLinkOut(
        outKey,
        outSummary,
        outStatus,
        linkOutward,
        issueLabel,
        issueType,
        fontawesomeIcon,
        cssClass
    ) {
        return `${issueLabel} -->|${linkOutward}| ${outKey}("${fontawesomeIcon}${outKey} ${outSummary}"):::${cssClass}`
    }

    static buildMermaidLinkChartDataBlock(
        issueResult,
        linkStyles,
        clicks,
        issueLabel
    ) {
        debug(`build...DataBlock(...) called for ${issueLabel}`)
        let htmlOutput = []
        if (issueResult.issuelinks) {
            for (let x = 0; x < issueResult.issuelinks.length; x++) {
                const link = issueResult.issuelinks[x]
                if (link.inwardIssue) {
                    linkStyles.push(mermaidConfig.links[link.type.inward])
                    clicks.push(link.inwardIssue.key)
                    debug(`inwardIssue: ${link.inwardIssue.key}`)
                    htmlOutput.push(
                        `${MermaidNodes.buildMermaidLinkIn(
                            link.inwardIssue.key,
                            link.inwardIssue.fields.summary,
                            link.inwardIssue.fields.status.name,
                            link.type.outward,
                            issueLabel,
                            link.inwardIssue.fields.issuetype.name,
                            JiraStatus.getFontawesomeIcon(link.inwardIssue.fields.issuetype.name),
                            JiraStatus.formatCssClassName(link.inwardIssue.fields.status.name)
                        )}\n`
                    )
                } else if (link.outwardIssue) {
                    const outKey = link.outwardIssue.key
                    let outLink = link.type.outward

                    debug(`link.outwardIssue.key: ${outKey} / ${outLink}`)

                    clicks.push(outKey)
                    linkStyles.push(mermaidConfig.links[link.type.outward])
                    htmlOutput.push(
                        `${MermaidNodes.buildMermaidLinkOut(
                            outKey,
                            link.outwardIssue.fields.summary,
                            link.outwardIssue.fields.status.name,
                            outLink,
                            issueLabel,
                            link.outwardIssue.fields.issuetype.name,
                            JiraStatus.getFontawesomeIcon(link.outwardIssue.fields.issuetype.name),
                            JiraStatus.formatCssClassName(link.outwardIssue.fields.status.name)
                        )}\n`
                    )
                } else {
                    htmlOutput.push(`unrecognized issue type`)
                }
            }

            debug(clicks.join(`\n`))
            return { html: htmlOutput.join(''), linkStyles: linkStyles, clicks: clicks }
        } else {
            debug(`ERR 734`)
            debug(issueResult)
            return false
        }
    }

    static buildMermaidLinkChart(issueResult, urlScript = false) {
        const htmlOutput = []
        const links = issueResult.issuelinks
        const id = issueResult.id

        const title = `Links for ${id}`
        debug(`writing to HTML/mermaid`)
        htmlOutput.push(`<div class="mermaid">
      graph LR
      `)
        let linkStyles = []
        let clicks = []
        clicks.push(issueResult.id)
        const issueLabel = `${issueResult.id}["${JiraStatus.getFontawesomeIcon(
            issueResult.type
        )} ${issueResult.id} ${issueResult.name}"]:::${JiraStatus.formatCssClassName(
            issueResult.status
        )}`

        const results = MermaidNodes.buildMermaidLinkChartDataBlock(
            issueResult,
            linkStyles,
            clicks,
            issueLabel,
            urlScript
        )
        htmlOutput.push(results.html)
        clicks.concat(results.clicks)
        linkStyles.concat(results.linkStyles)

        clicks.forEach((c) => {
            if (urlScript) {
                htmlOutput.push(`click ${c} "${urlScript}${c}"\n`)
            } else {
                htmlOutput.push(
                    `click ${c} "${config.get('jira.protocol')}://${
                    config.get('jira.host')
                    }/browse/${c}" _blank\n`
                )
            }
        })
        linkStyles.forEach((ls, ndx) => {
            htmlOutput.push(`linkStyle ${ndx} ${ls}\n`)
        })
        htmlOutput.push(`
      classDef Icebox fill:#ccc,color:#000;
      classDef InProgress fill:#84a98c,color:#000;
      classDef InReview fill:#b4d9bc,color:#000;
      classDef Defined fill:#fff,color:#000;
      classDef Done fill:#00f,color:#fff;
      classDef Dead fill:#000,color:#fff;
      classDef Emergency fill:#95190c,color:#fff;
      classDef Blocked fill:#e3b505,color:#fff;
      `)
        htmlOutput.push(`</div><!-- end mermaid div -->`)
        return htmlOutput.join('')
    }
}

module.exports = MermaidNodes;
