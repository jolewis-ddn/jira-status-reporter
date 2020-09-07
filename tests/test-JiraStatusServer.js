const test = require('ava')
const debug = require('debug')('ava-tests-JiraStatusServer')

const server = require('../JiraStatusServer')

const supertest = require('supertest')
const request = supertest(server)

test('JiraStatusServer/config returns 200 or 300', async (t) => {
   const res = await request.get('/config')
   t.regex(res.type, /json/)
   t.assert(res.status < 400)
})

test('/fields fetches live field list with at least one row', async (t) => {
   const res = await request.get('/fields')
   t.regex(res.type, /json/)
   t.assert(res.status < 400)
   t.assert(res.body.length > 0)
})

test.skip('/report fetches object', async (t) => {
   const res = await request.get('/report')
   t.regex(res.header['content-type'], /json/)
   t.true(res.status, 200)
})

