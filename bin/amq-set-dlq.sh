#!/bin/sh
if [ -n "$1" ]
then
    vhost="$1"
else
    vhost=/
fi
sudo rabbitmqctl set_policy -p "$vhost" DLX '^(?!@DLQ)' '{"dead-letter-exchange":"","dead-letter-routing-key":"@DLQ"}' --apply-to queues
