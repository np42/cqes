CREATE TABLE `@subscriptions` (
  `subscriptionId` varchar(128) COLLATE 'ascii_general_ci' NOT NULL,
  `position` bigint NOT NULL
);
ALTER TABLE `@subscriptions`
ADD PRIMARY KEY `subscriptionId` (`subscriptionId`);
