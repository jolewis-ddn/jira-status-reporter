/** @format */

const debug = require('debug')('jira-data-parser')
const fs = require('fs')
const path = require('path')

const futils = require('./functionUtils')
const jiraUtils = require('./jiraUtils')

const pinoDebug = require('pino-debug')
const logger = require('pino')(
  {
    level: process.env.LOG_LEVEL || 'info',
  },
  process.stderr
)
// Following https://github.com/pinojs/pino-debug
pinoDebug(logger, {
  auto: true,
  map: {
    'jira-data-parser': 'debug',
    '*': 'trace',
  },
})

/**
 * Parse JSON data returned from Jira JQL query
 */
class JiraDataParser {
  hasData = false // Has data been supplied?
  cleanData = false // Has data been cleaned?
  raw // Raw data

  query = false // JQL query (if data from JSR)
  recordCount = false // How many issues in the data set
  containsHistory = false // Revision history in the data

  constructor(newData = false) {
    logger.debug('JiraDataParser created')
    if (newData) {
      this._processData(newData)
    }
    return this
  }

  /**
   * Process newly supplied data.
   * @param {Object} newData Data from JQL query - or JSR
   * @returns {Boolean} Success
   */
  data(newData = false) {
    if (newData) {
      // Process
      try {
        let result = this._processData(newData)
        if (!futils.isSuccess(result)) {
          throw new Error(`Failure in _processData: ${result.result}`)
        } else {
          return result
        }
      } catch (err) {
        return err
      }
    } else {
      return this.raw
    }
  }

  /**
   * Return summary details on loaded data.
   * @returns {Object} Summary details
   */
  summary() {
    if (this.raw) {
      return {
        issueCount: this.issueCount,
        containsHistory: this.containsHistory,
      }
    } else {
      throw new Error('Data not yet loaded.')
    }
  }

  getStats() {
    return this.stats
  }

  /**
   * Crunch the data and ensure it is properly formatted.
   * May contain JSR metadata or be the raw JQL results.
   * @param {Object} data Results from JQL query
   * @returns {Boolean} Processing successful?
   */
  _processData(data) {
    try {
      this.raw = this._validateData(data)
      this.hasData = true
      this.cleanData = true
      this.issueCount = this.raw.length
      this.userIds = {}

      this.stats = {}

      this.statusList = this._buildStatusList()
      this.userList = this._buildUserList()
      this.typeList = this._buildTypeList()
      this.timelines = this._buildTimeline()

      this.summaryStats = this._buildSummaryStats()
      return futils.success()
    } catch (err) {
      logger.warn(`Error in _validateData: ${err.message}`)
      throw err
    }
  }

  /**
   * Create a list of the Issue Status values with summary stats
   * @returns {Object} Status data: key = Jira Status name
   *   Each entry = { count: <total #> }
   */
  _buildStatusList() {
    let statusStats = {}
    for (let ndx = 0; ndx < this.raw.length; ndx++) {
      const i = this.raw[ndx]
      let thisStatus = i.fields.status.name
      if (!Object.keys(statusStats).includes(thisStatus)) {
        // Add a new status
        statusStats[thisStatus] = { count: 1 }
      } else {
        statusStats[thisStatus].count += 1
      }
    }

    let statusCount = 0
    for (let ndx = 0; ndx < Object.keys(statusStats).length; ndx++) {
      const s = Object.keys(statusStats)[ndx]
      statusCount += statusStats[s].count
    }
    if (statusCount !== this.issueCount) {
      throw new Error(
        `statusStats total count (${statusCount}) !== issue count ${this.issueCount}`
      )
    }
    this.statusesProcessed = true
    return statusStats
  }

  /**
   * Create a list of the users with names and IDs
   * @returns {Object} Status data: key = Jira Status name
   *   Each entry = { id: <id>,
   *        assigneeList: [],   // List of issues owned by this user
   *        assigneeCount: <#>, // Count of issues owned by this user
   *        changeList: [],     // List of issues changed by this user (no duplicates)
   *        changeCount: <#>    // Count of changes performed by this user
   *  }
   */
  _buildUserList() {
    let users = {}
    for (let ndx = 0; ndx < this.raw.length; ndx++) {
      // Process Assignee name
      if (
        !Object.keys(users).includes(this.raw[ndx].fields.assignee.displayName)
      ) {
        users[this.raw[ndx].fields.assignee.displayName] = {
          id: this.raw[ndx].fields.assignee.accountId,
          assigneeCount: 1,
          assigneeList: [this.raw[ndx].key],
          changeCount: 0,
          changeList: [],
        }
        if (
          !Object.keys(this.userIds).includes(
            this.raw[ndx].fields.assignee.accountId
          )
        ) {
          this.userIds[this.raw[ndx].fields.assignee.accountId] =
            this.raw[ndx].fields.assignee.displayName
        }
      } else {
        users[this.raw[ndx].fields.assignee.displayName].assigneeCount += 1
        users[this.raw[ndx].fields.assignee.displayName].assigneeList.push(
          this.raw[ndx].key
        )
      }
      // Process updates
      if (this.containsHistory) {
        for (
          let logndx = 0;
          logndx < this.raw[ndx].changelog.histories.length;
          logndx++
        ) {
          if (
            !Object.keys(users).includes(
              this.raw[ndx].changelog.histories[logndx].author.displayName
            )
          ) {
            users[
              this.raw[ndx].changelog.histories[logndx].author.displayName
            ] = {
              id: this.raw[ndx].changelog.histories[logndx].author.accountId,
              changeCount: 1,
              changeList: [],
              assigneeCount: 0,
              assigneeList: [],
            }

            if (
              !Object.keys(this.userIds).includes(
                this.raw[ndx].changelog.histories[logndx].author.accountId
              )
            ) {
              this.userIds[
                this.raw[ndx].changelog.histories[logndx].author.accountId
              ] = this.raw[ndx].changelog.histories[logndx].author.displayName
            }
          } else {
            users[
              this.raw[ndx].changelog.histories[logndx].author.displayName
            ].changeCount += 1
            if (
              !users[
                this.raw[ndx].changelog.histories[logndx].author.displayName
              ].changeList.includes(this.raw[ndx].key)
            ) {
              users[
                this.raw[ndx].changelog.histories[logndx].author.displayName
              ].changeList.push(this.raw[ndx].key)
            }
          }
        }
      }
    }
    this.usersProcessed = true
    return users
  }

  /**
   * Create a list of the Issue Types with summary stats
   * @returns {Object} Status data: key = Jira Issue Type
   *   Each entry = { count: <total #> }
   */
  _buildTypeList() {
    let typeStats = {}
    for (let ndx = 0; ndx < this.raw.length; ndx++) {
      const i = this.raw[ndx]
      let thisType = i.fields.issuetype.name
      if (!Object.keys(typeStats).includes(thisType)) {
        // Add a new type
        typeStats[thisType] = {
          count: 1,
          id: i.fields.issuetype.id,
          iconUrl: i.fields.issuetype.iconUrl,
        }
      } else {
        typeStats[thisType].count += 1
      }
    }

    let typeCount = 0
    for (let ndx = 0; ndx < Object.keys(typeStats).length; ndx++) {
      const t = Object.keys(typeStats)[ndx]
      typeCount += typeStats[t].count
    }
    if (typeCount !== this.issueCount) {
      throw new Error(
        `typeStats total count (${typeCount}) !== issue count ${this.issueCount}`
      )
    }

    this.typesProcessed = true
    return typeStats
  }

  /**
   * Build comprehensive timeline for all issues (using this.rawData)
   * @returns {Array} Timeline data: one array entry per Jira issue
   */
  _buildTimeline() {
    if (!this.typesProcessed) {
      this._buildTypeList()
    }
    if (!this.usersProcessed) {
      this._buildUserList()
    }
    if (!this.statusesProcessed) {
      this._buildStatusList()
    }

    let timelines = {}
    for (let ndx = 0; ndx < this.raw.length; ndx++) {
      const i = this.raw[ndx]
      timelines[i.key] = this._buildIssueTimeline(i)
    }
    // debug(timelines)
    return timelines
  }

  /**
   * Build timeline for a single issue
   * @param {Object} issueData Jira data object
   * {
   *    title: <String>      // Jira issue title/name
   *    age: {
   *      days: <#>          // # of days old
   *      source: <String>   // Where the Age comes from
   *                         // (created field or earliest changelog entry)
   *    }
   *    ageStatus: <#>       // # of days since last Status change
   *    ageAssignee: <#>     // # of days since last assigned
   *    updates: {
   *      count: <#>         // # of updates
   *      authors: []        // Array of users who updated the issue
   *    }
   *    statusChanges: <#>   // # of times the Status changed
   *    assignee: {
   *      changes: <#>       // # of times the Assignee changed
   *      count: <#>         // # of unique Assignees
   *      list: []           // Array of Assignees (including current)
   *    }
   * }
   */
  _buildIssueTimeline(issueData) {
    let timeline = {
      title: '',
      age: { days: 0, source: '' },
      ageStatus: 0,
      ageAssignee: 0,
      updates: { count: 0, authors: [] },
      statusChanges: 0,
      assignee: { count: 0, changes: 0, list: [] },
    }

    timeline.title = issueData.fields.summary

    // age and ageSource
    // Try first from the 'created' field, if it exists
    if (issueData.fields.created) {
      timeline.age.days = jiraUtils.convertTimestampToElapsedDays(
        issueData.fields.created
      )
      timeline.age.source = 'created'
    }

    // Changelogs are used for all the other fields
    if (this.containsHistory) {
      // If there was no 'created' field, use the earliest changelog date
      if (timeline.age.days == 0) {
        if (issueData.changelog.histories.length) {
          // TODO: Convert date string to age (in days)
          timeline.age.days = jiraUtils.convertTimestampToElapsedDays(
            issueData.changelog.histories[
              issueData.changelog.histories.length - 1
            ].created
          )
          timeline.age.source = 'changelog'
        }
      }

      // Updates
      timeline.updates.count = issueData.changelog.histories.length
      timeline.updates.authors = [
        ...new Set(
          issueData.changelog.histories.map((x) => x.author.displayName)
        ),
      ]

      // Now cycle through the changelog...
      for (let ndx = 0; ndx < issueData.changelog.histories.length; ndx++) {
        const history = issueData.changelog.histories[ndx]
        // Each changelog has multiple 'items' or edits

        for (
          let historyNdx = 0;
          historyNdx < history.items.length;
          historyNdx++
        ) {
          const elem = history.items[historyNdx]
          // statusChanges
          if (elem.fieldId == 'status') {
            timeline.statusChanges += 1
            // ageStatus (use only the latest edit == lower index)
            if (timeline.ageStatus == 0) {
              // Convert date string to age (in days)
              timeline.ageStatus = jiraUtils.convertTimestampToElapsedDays(
                history.created
              )
            }
          }

          // Assignee details
          if (elem.fieldId == 'assignee') {
            // assigneeChanges
            timeline.assignee.changes += 1

            // ageAssignee (if not already set)
            if (timeline.ageAssignee == 0) {
              // Convert date string to age (in days)
              timeline.ageAssignee = jiraUtils.convertTimestampToElapsedDays(
                history.created
              )
            }

            // Changing assignee to someone? Record the assignee
            if (!timeline.assignee.list.includes(elem.to)) {
              // Convert ID to name
              timeline.assignee.list.push(this.convertUserIdToName(elem.to))
              timeline.assignee.count += 1
            }

            // First assignment?
            if (elem.from == 'null') {
            }
          }
        }
      }
      if (timeline.ageAssignee == 0) {
        // Reset empty Assignee age value to age of the issue
        timeline.ageAssignee = timeline.age.days
      }
      if (timeline.ageStatus == 0) {
        // Reset empty Status age value to age of the issue
        timeline.ageStatus = timeline.age.days
      }
    } else {
      timeline.msg = `No update history present`
    }
    return timeline
  }

  _buildSummaryStats() {}

  /**
   * Make sure the data is properly structured.
   * Determine if history is included or not.
   * Note: this function will strip out the JSR-added metadata.
   * @param {Object} data Results from JQL query
   * @returns {Array} All issues (minus metadata from JSR)
   */
  _validateData(data) {
    logger.debug('data.comment: %s', data.comment)
    if (data) {
      // Are query results from JSR, not directly from Jira?
      if (data.comment == 'Compiled by JiraStatusReporter' && data.issues) {
        this.query = data.query
        if (data.total == data.issues.length) {
          this.recordCount = data.total
        } else {
          throw new Error(
            `data.total (${data.total}) !== data.issues.length ${data.issues.length}`
          )
        }

        // Does changelog exist for all issues?
        if (
          data.issues.filter((x) => x.changelog).length == data.issues.length
        ) {
          this.containsHistory = true
        }
        if (data.issues[0].fields) {
          return data.issues
        } else {
          throw new Error('Missing fields data')
        }
      } else {
        throw new Error('Unrecognized data: missing comment and/or issues')
      }
    } else {
      throw new Error('Missing data')
    }
  }

  convertUserIdToName(id) {
    // debug(`convertUserIdToName(${id}) called...`)
    return Object.keys(this.userIds).includes(id) ? this.userIds[id] : ''
  }
}

module.exports = JiraDataParser
