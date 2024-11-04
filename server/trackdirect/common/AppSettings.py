
# Respect max_default_time from ini file even for OGN source
debug_ogn_ini_max_default_time = False

# Respect frequency_limit from ini file even for OGN source
debug_ogn_ini_frequency_limit = False

# Allow identify all senders
debug_ogn_allow_identify_all = False

# Allow tracking all senders
debug_ogn_allow_track_all = False

# Allowed out of order interval for OGN packet [s]
# Some OGN receivers send packets a little bit later,
# thus will do not igore them then (usefull with debug_order_by_reported_timestamp)
debug_ogn_allowed_out_of_order_interval = 10

# Order packets by packet.reported_timestamp first, and then by packet.id
# This allows packets received out of order with respect
# to their reported_timestamp to be ordered correctly when displaying on web
debug_order_by_reported_timestamp = True
