Date.prototype.addBusinessDays = function (dplus, adjustSilently = false) {
  const verbose = false // Enable extra diagnostic output
  const d = new Date(this)

  // If the incoming date is in a weekend, push to the next weekday
  // adjustSilently governs display (or not) of forced date change
  if (d.getDay() === 0) {
    if (!adjustSilently) {
      // Display forced input date change?
      console.error(
        `Error: invalid day of week: ${d.getDay()}; expected value between 1 and 5, inclusive. Forcing to next business day`
      )
    }
    d.setDate(d.getDate() + 1)
    if (!adjustSilently) {
      console.log(
        `new d: ${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
      )
    }
  } else if (d.getDay() === 6) {
    if (!adjustSilently) {
      // Display forced input date change?
      console.error(
        `Error: invalid day of week: ${d.getDay()}; expected value between 1 and 5, inclusive. Forcing to next business day`
      )
    }
    d.setDate(d.getDate() + 2)
    if (!adjustSilently) {
      console.log(
        `new d: ${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
      )
    }
  }

  const now = new Date(d.getTime())

  const d2we = 6 - d.getDay()
  const d2m = d2we + 2
  let daystoadd = dplus

  if (dplus >= d2we) {
    daystoadd =
      d2m - 1 + (dplus - (d2we - 1)) + Math.floor((dplus - d2we) / 5) * 2
  }

  d.setDate(d.getDate() + daystoadd)

  if (verbose) {
    console.log(
      `${
        now.getMonth() + 1
      }/${now.getDate()}/${now.getFullYear()} + ${dplus} = ${
        d.getMonth() + 1
      }/${d.getDate()}/${d.getFullYear()}`
    )
  }

  // If the newly calculated date is on a weekend, throw a new Error
  if (d.getDay() === 0 || d.getDay() === 6) {
    throw new Error(
      `Error: invalid result day of week: ${d.getDay()}; Value must be between 1 and 5, inclusive.`
    )
  }

  return d
}

/* workingDaysFrom
 *
 * Source: https://mygeekjourney.com/programming-notes/javascript-how-to-calculate-number-of-working-days/
 *
 */
Date.prototype.workingDaysFrom = function (fromDate) {
  // ensure that the argument is a valid and past date
  if (!fromDate || isNaN(fromDate) || this < fromDate) {
    console.log(`ERR: invalid date!`)
    return -1
  }

  // clone date to avoid messing up original date and time
  var frD = new Date(fromDate.getTime()),
    toD = new Date(this.getTime()),
    numOfWorkingDays = 1

  // reset time portion
  frD.setHours(0, 0, 0, 0)
  toD.setHours(0, 0, 0, 0)

  while (frD < toD) {
    frD.setDate(frD.getDate() + 1)
    var day = frD.getDay()
    if (day != 0 && day != 6) {
      numOfWorkingDays++
    }
  }
  return numOfWorkingDays
}

/* workingDaysFromNow: Calculate number of working days to some future date
 *
 * Parameter: {date} toDate Future date
 * Returns: {number} Number of working days between now and toDate
 *
 * Based on: https://mygeekjourney.com/programming-notes/javascript-how-to-calculate-number-of-working-days/
 *
 */
Date.prototype.workingDaysFromNow = function (toDate) {
  // ensure that the argument is a valid and past date
  try {
    let toD = new Date(toDate)

    if (!toDate || toD < this) {
      return -1
    }

    // clone date to avoid messing up original date and time
    //   var toD = new Date(toDate.getTime())
    var frD = new Date(this.getTime())
    var numOfWorkingDays = 1

    // reset time portion
    frD.setHours(0, 0, 0, 0)
    toD.setHours(0, 0, 0, 0)

    while (frD < toD) {
      frD.setDate(frD.getDate() + 1)
      var day = frD.getDay()
      if (day != 0 && day != 6) {
        numOfWorkingDays++
      }
    }
    return numOfWorkingDays
  } catch (error) {
    throw new Error(`Invalid toDate ${toDate}`)
  }
}

// Source: http://stackoverflow.com/questions/563406/ddg#563442
Date.prototype.addDays = function(days) {
  var date = new Date(this.valueOf())
  date.setDate(date.getDate() + days)
  return date
}
