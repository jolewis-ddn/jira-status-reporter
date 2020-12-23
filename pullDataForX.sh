#!/bin/bash

array=("ICEBOX" "DEFINED" "IN PROGRESS" "IN REVIEW" "DONE" "EMERGENCY" "BLOCKED" "DEAD")

today_year=`date '+%Y'`;
today_mon=`date '+%m'`;
today_day=`date '+%d'`;

yesterday_year=`date -d "$1 13:00" '+%Y'`
yesterday_mon=`date -d "$1 13:00" '+%m'`
yesterday_day=`date -d "$1 13:00" '+%d'`

echo "Fetching all records for $yesterday_year-$yesterday_mon-$yesterday_day..."

for entry in "${array[@]}"
do
	echo "...$entry..."
	`node getIssuesByStatusOnDate -s "$entry" -y $yesterday_year -m $yesterday_mon -d $yesterday_day > "./$1/$entry-$yesterday_year-$yesterday_mon-$yesterday_day.json"`
	sleep 3
done
