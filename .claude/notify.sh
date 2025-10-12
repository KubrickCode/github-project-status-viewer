#!/bin/bash

WEBHOOK_URL="https://discord.com/api/webhooks/1426399609382506588/4RZ1VJgLs4uczKgRw1mIeK_BMm8lXLIFul3mkozAz1maIhTW2-THqJXSI6EJnU_XUpbi"
START_TIME_FILE="/tmp/claude_start_time"
MIN_DURATION=10

cat > /dev/null

CURRENT_TIME=$(date +%s)

if [ -f "$START_TIME_FILE" ]; then
  START_TIME=$(cat "$START_TIME_FILE")
  DURATION=$((CURRENT_TIME - START_TIME))
  
  if [ $DURATION -ge $MIN_DURATION ]; then
    MINUTES=$((DURATION / 60))
    SECONDS=$((DURATION % 60))
    
    curl -s -X POST \
      -H 'Content-type: application/json' \
      --data "{\"content\":\"✅ 작업 완료! (${MINUTES}분 ${SECONDS}초)\"}" \
      "$WEBHOOK_URL" || true
  fi
  
  rm -f "$START_TIME_FILE"
else
  echo "$CURRENT_TIME" > "$START_TIME_FILE"
fi
