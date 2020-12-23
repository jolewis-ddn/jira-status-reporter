const test = require('ava')
const debug = require('debug')('ava-tests-CLM')

const fs = require('fs')

const ChartLinkMaker = require('../ChartLinkMaker')

const CONFIG_JS = 'config'

const TEST_TITLE = 'test title'
const TEST_DATA_OBJ = {
    Open: 10,
    Active: 20,
    Closed: 30,
    Stopped: 40
}

const TEST_DATA_ARR = [1, 2, 3]
const TEST_CATEGORIES = ['a', 'b', 'c']

/*-----------------------------------
   ChartLinkMaker Tests
/------------------------------------*/

test('Confirm CLM load', (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    t.pass()
})

test('Reset', (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    t.assert(clm.reset() == clm)
})

test('Set Bar chart', (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    t.assert(clm.setBarChart() == clm)
})

test('Set Line chart', (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    t.assert(clm.setLineChart() == clm)
})

test('Set Chart type', (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    t.assert(clm.setChartType('Doughnut') == clm)
})

test('Set Fill', (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    t.assert(clm.setFill('#ff0000') == clm)
})

test('Set Size', (t) => {
    const NEW_SIZE = 10
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    clm.setSize(NEW_SIZE)
    t.assert(clm.h == NEW_SIZE)
    t.assert(clm.w == NEW_SIZE)
})

test('Build datasets', (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    const datasets = clm._buildDatasets()
    t.assert(typeof datasets == typeof "")
})

test('Validate Categories: Fails (pre setCategories())', (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    clm.dataCategories = false
    t.throws(() => {
        clm._validateCategories(3)
    })
})

test('Set Categories', (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    t.assert(clm.setCategories(TEST_CATEGORIES) == clm)
})

test('Validate Categories: Good', (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    t.notThrows(() => {
        clm._validateCategories(3)
    })
})

test('Validate Categories: Invalid category size', (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    t.throws(() => {
        clm._validateCategories(2)
    })
})

test('Add series: Good', (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    t.assert(clm.addSeries('more data', [10, 20, 30]) == clm)
})

test('Add series: Bad', (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    t.assert(clm.addSeries('more data', [30]) == clm)
})

test('Confirm bar chart content', async (t) => {
    const clm = new ChartLinkMaker(TEST_DATA_ARR, TEST_CATEGORIES)
    const config = require(CONFIG_JS)

    const chart = await clm.buildChartImgTag(TEST_TITLE, TEST_DATA_OBJ)
    t.true(typeof chart == 'string')
    t.regex(chart, /bb.generate/)
    t.regex(chart, /size/)
    t.regex(chart, /title/)
    t.regex(chart, /type: "pie"/)
})
