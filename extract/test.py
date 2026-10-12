import pandas as pd 


df = pd.read_csv('data/uniswap_v4_pool_metadata.csv')

df['block_number'].unique().tail(1)