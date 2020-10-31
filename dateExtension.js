Date.prototype.addBusinessDays = function (dplus, adjustSilently = false) {
    const verbose = false // Enable extra diagnostic output
    const d = new Date(this)

    // If the incoming date is in a weekend, push to the next weekday
    // adjustSilently governs display (or not) of forced date change
    if (d.getDay() === 0) {
        if (!adjustSilently) { // Display forced input date change?
            console.error(`Error: invalid day of week: ${d.getDay()}; expected value between 1 and 5, inclusive. Forcing to next business day`)
        }
        d.setDate(d.getDate() + 1)
        if (!adjustSilently) { console.log(`new d: ${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`) }
    } else if (d.getDay() === 6) {
        if (!adjustSilently) { // Display forced input date change?
            console.error(`Error: invalid day of week: ${d.getDay()}; expected value between 1 and 5, inclusive. Forcing to next business day`)
        }
        d.setDate(d.getDate() + 2)
        if (!adjustSilently) { console.log(`new d: ${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`) }
    }

    const now = new Date(d.getTime())

    const d2we = 6 - d.getDay()
    const d2m = d2we + 2
    let daystoadd = dplus

    if (dplus >= d2we) {
        daystoadd = (d2m - 1) + (dplus - (d2we - 1)) + (Math.floor((dplus - d2we) / 5) * 2)
    }

    d.setDate(d.getDate() + daystoadd)

    if (verbose) {
        console.log(`${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} + ${dplus} = ${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`)
    }

    // If the newly calculated date is on a weekend, throw a new Error
    if (d.getDay() === 0 || d.getDay() === 6) {
        throw new Error(`Error: invalid result day of week: ${d.getDay()}; Value must be between 1 and 5, inclusive.`)
    }

    return (d)
}