#!/bin/bash

array=("ICEBOX" "DEFINED" "IN PROGRESS" "IN REVIEW" "DONE" "EMERGENCY" "BLOCKED" "DEAD")

mon=$1

echo "Fetching all records for Month $mon..."

for entry in "${array[@]}"
do
	echo "...$entry..."
	`node getIssueCountsByStatusAndMonth.js -s "$entry" -m $mon`
	sleep 3
done
