CREATE TABLE `@states` (
  `stateId` varchar(128) COLLATE 'ascii_general_ci' NOT NULL,
  `revision` int unsigned NOT NULL,
  `data` longtext COLLATE 'utf8_general_ci' NOT NULL
);
ALTER TABLE `@states`
ADD PRIMARY KEY `stateId` (`stateId`);
