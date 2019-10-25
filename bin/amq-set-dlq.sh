
sudo rabbitmqctl set_policy -p / DLX '^(?!@DLQ)' '{"dead-letter-exchange":"","dead-letter-routing-key":"@DLQ"}' --apply-to queues
