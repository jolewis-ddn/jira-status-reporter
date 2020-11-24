// Convert seconds into days
function convertSecondsToDays(sec) {
  let result = (sec / 28800).toFixed(2);
  if (result == Math.round(result)) { result = Math.round(result); }
  return (result);
}
exports.convertSecondsToDays = convertSecondsToDays;
