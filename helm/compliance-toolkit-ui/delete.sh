#!/bin/sh
# Uninstalls all  compliance-toolkit helm charts

function deleting_compliance-toolkit-ui() {
NS=compliance-toolkit
  while true; do
      read -p "Are you sure you want to delete all compliance-toolkit-ui helm charts?(Y/n) " yn
      if [ $yn = "Y" ]
        then
          helm -n $NS delete compliance-toolkit-ui
          break
        else
          break
      fi
  done
  return 0
}

# set commands for error handling.
set -e
set -o errexit   ## set -e : exit the script if any statement returns a non-true return value
set -o nounset   ## set -u : exit the script if you try to use an uninitialised variable
set -o errtrace  # trace ERR through 'time command' and other functions
set -o pipefail  # trace ERR through pipes
deleting_compliance-toolkit-ui   # calling function
