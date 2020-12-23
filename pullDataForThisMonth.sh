#!/bin/bash

array=("ICEBOX" "DEFINED" "IN PROGRESS" "IN REVIEW" "DONE" "EMERGENCY" "BLOCKED" "DEAD")

today_year=`date '+%Y'`;
today_mon=`date '+%m'`;
today_day=`date '+%d'`;

yesterday_year=`date -d "Yesterday 13:00" '+%Y'`
yesterday_mon=`date -d "Yesterday 13:00" '+%m'`
yesterday_day=`date -d "Yesterday 13:00" '+%d'`

echo "Fetching all records for this month"

for d in $(seq -f "%02g" 1 ${yesterday_day})
do
    for entry in "${array[@]}"
    do
	    echo "...$entry $d..."
	    `node getIssuesByStatusOnDate -s "$entry" -y $yesterday_year -m $yesterday_mon -d $d > "./$1/$entry-$yesterday_year-$yesterday_mon-$d.json"`
	    sleep 3
    done
done