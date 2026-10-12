SELECT
    address,
    block_number,
    block_timestamp,
    event_name,
    event_signature,
    parameters['fee'] AS fee_tier,
    parameters['hooks'] AS hook_address,
    parameters['sqrtPriceX96'] AS init_sqrt_price_x96,
    parameters['tick'] AS init_tick,
    parameter_types,
    parameters['tickSpacing'] AS tick_spacing,
    parameters['currency0'] AS token0_address,
    parameters['currency1'] AS token1_address,
    transaction_from,
    transaction_hash,
    transaction_to
FROM base.events
WHERE address = '0x498581ff718922c3f8e6a244956af099b2652b2b'
  AND event_signature = 'Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)'
  AND action = 1
  AND block_number >= 34363231
ORDER BY block_number ASC
LIMIT 50000;
