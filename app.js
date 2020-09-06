'use strict'
const debug = require('debug')('app-js')
const config = require('config')

const server = require('./JiraStatusServer')

server.listen(config.get('server.port'), function () {
  console.log(
    `${server.name} listening at ${server.url} [Jira Server: ${
      config.get('jira.username')
    } @ ${config.get('jira.host')}]`
  )
})
